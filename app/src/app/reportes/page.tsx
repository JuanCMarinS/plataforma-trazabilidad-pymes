
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  email: string;
  full_name: string | null;
  role: "administrador" | "tecnico" | "usuario";
};

type Persona = {
  id: string;
  nombre: string;
  email: string;
};

type Evento = {
  id: string;
  codigo: string;
  tipo: string;
  asunto: string;
  categoria: string | null;
  prioridad: string;
  estado: string;
  tecnico_id: string | null;
  reportado_por: string | null;
  created_at: string;
  fecha_solucion: string | null;
};

type Periodo = "30" | "3" | "6" | "12" | "mas12";

const nombresRoles = {
  administrador: "Administrador",
  tecnico: "Técnico",
  usuario: "Usuario",
};

const opcionesMenu = [
  { nombre: "Resumen", ruta: "/resumen", icono: "▦" },
  { nombre: "Incidentes", ruta: "/incidentes", icono: "⚠" },
  { nombre: "Requerimientos", ruta: "/requerimientos", icono: "▤" },
  { nombre: "Analítica", ruta: "/analitica", icono: "▥" },
  { nombre: "Reportes", ruta: "/reportes", icono: "▧" },
  { nombre: "Usuarios", ruta: "/usuarios", icono: "♙" },
];

function SelectorPersonas({
  titulo,
  personas,
  seleccionados,
  abierto,
  setAbierto,
  cambiarSeleccion,
}: {
  titulo: string;
  personas: Persona[];
  seleccionados: string[];
  abierto: boolean;
  setAbierto: (valor: boolean) => void;
  cambiarSeleccion: (id: string) => void;
}) {
  const todosSeleccionados = seleccionados.length === 0;

  const nombresSeleccionados = todosSeleccionados
    ? "Todos"
    : personas
        .filter((persona) => seleccionados.includes(persona.id))
        .map((persona) => persona.nombre)
        .join(", ");

  return (
    <div className="relative min-w-0">
      <label className="mb-2 block text-sm font-semibold text-slate-600">
        {titulo}
      </label>

      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 outline-none transition hover:border-blue-400 focus:border-blue-500"
      >
        <span className="min-w-0 truncate">
          {nombresSeleccionados || "Seleccionar"}
        </span>

        <span className="shrink-0 text-xs">
          {abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            <input
              type="checkbox"
              checked={todosSeleccionados}
              onChange={() => cambiarSeleccion("TODOS")}
              className="h-4 w-4 accent-blue-600"
            />
            Todos
          </label>

          <div className="border-t border-slate-100" />

          {personas.length > 0 ? (
            personas.map((persona) => (
              <label
                key={persona.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(persona.id)}
                  onChange={() => cambiarSeleccion(persona.id)}
                  className="h-4 w-4 accent-blue-600"
                />

                <span className="min-w-0">
                  <span className="block truncate">
                    {persona.nombre}
                  </span>

                  <span className="block truncate text-xs text-slate-400">
                    {persona.email}
                  </span>
                </span>
              </label>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-xs text-slate-400">
              No hay personas registradas con este rol.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Reportes() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(true);

  // FILTROS
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [tipoEvento, setTipoEvento] = useState("ambos");

  const [tecnicos, setTecnicos] = useState<Persona[]>([]);
  const [usuarios, setUsuarios] = useState<Persona[]>([]);

  const [tecnicosSeleccionados, setTecnicosSeleccionados] =
    useState<string[]>([]);

  const [usuariosSeleccionados, setUsuariosSeleccionados] =
    useState<string[]>([]);

  const [tecnicosAbierto, setTecnicosAbierto] = useState(false);
  const [usuariosAbierto, setUsuariosAbierto] = useState(false);

  // RESULTADOS DEL REPORTE
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [reporteGenerado, setReporteGenerado] = useState(false);
  const [consultando, setConsultando] = useState(false);

  const [mensaje, setMensaje] = useState(
    "Selecciona los filtros y pulsa Actualizar reporte."
  );

  const [ultimaActualizacion, setUltimaActualizacion] =
    useState<string | null>(null);

  // CARGAR PERFIL Y PERSONAS
  useEffect(() => {
    let activo = true;

    async function cargarInformacion() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/");
        return;
      }

      const { data: datosPerfil, error: errorPerfil } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", data.user.id)
        .single();

      if (errorPerfil || !datosPerfil) {
        console.error("Error al cargar el perfil:", errorPerfil);
        await supabase.auth.signOut();
        router.replace("/");
        return;
      }

      if (!activo) return;

      const perfilActual = datosPerfil as Perfil;
      setPerfil(perfilActual);

      if (perfilActual.role !== "administrador") {
        setCargando(false);
        return;
      }

      const { data: personas, error: errorPersonas } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .in("role", ["tecnico", "usuario"]);

      if (errorPersonas) {
        console.error("Error al cargar las personas:", errorPersonas);
      } else if (activo) {
        const listaTecnicos: Persona[] = [];
        const listaUsuarios: Persona[] = [];

        (personas || []).forEach((persona) => {
          const nombre = persona.full_name?.trim() || persona.email;

          const elemento: Persona = {
            id: persona.id,
            nombre,
            email: persona.email,
          };

          if (persona.role === "tecnico") {
            listaTecnicos.push(elemento);
          }

          if (persona.role === "usuario") {
            listaUsuarios.push(elemento);
          }
        });

        listaTecnicos.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", {
            sensitivity: "base",
          })
        );

        listaUsuarios.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", {
            sensitivity: "base",
          })
        );

        setTecnicos(listaTecnicos);
        setUsuarios(listaUsuarios);
      }

      if (activo) setCargando(false);
    }

    void cargarInformacion();

    return () => {
      activo = false;
    };
  }, [router]);

  // CERRAR SESIÓN
  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  // SELECCIONAR TÉCNICOS
  function cambiarTecnico(id: string) {
    if (id === "TODOS") {
      setTecnicosSeleccionados([]);
      return;
    }

    setTecnicosSeleccionados((actuales) => {
      const nuevos = actuales.includes(id)
        ? actuales.filter((item) => item !== id)
        : [...actuales, id];

      return nuevos.length === tecnicos.length ? [] : nuevos;
    });
  }

  // SELECCIONAR USUARIOS
  function cambiarUsuario(id: string) {
    if (id === "TODOS") {
      setUsuariosSeleccionados([]);
      return;
    }

    setUsuariosSeleccionados((actuales) => {
      const nuevos = actuales.includes(id)
        ? actuales.filter((item) => item !== id)
        : [...actuales, id];

      return nuevos.length === usuarios.length ? [] : nuevos;
    });
  }

  // CONSULTAR REPORTE
  const consultarReporte = useCallback(async () => {
    setConsultando(true);

    try {
      const fechaActual = new Date();
      const fechaLimite = new Date(fechaActual);

      switch (periodo) {
        case "30":
          fechaLimite.setDate(fechaLimite.getDate() - 30);
          break;

        case "3":
          fechaLimite.setMonth(fechaLimite.getMonth() - 3);
          break;

        case "6":
          fechaLimite.setMonth(fechaLimite.getMonth() - 6);
          break;

        case "12":
        case "mas12":
          fechaLimite.setFullYear(fechaLimite.getFullYear() - 1);
          break;
      }

      let consulta = supabase
        .from("casos")
        .select(
          "id, codigo, tipo, asunto, categoria, prioridad, estado, tecnico_id, reportado_por, created_at, fecha_solucion"
        )
        .order("created_at", { ascending: false });

      if (periodo === "mas12") {
        consulta = consulta.lt(
          "created_at",
          fechaLimite.toISOString()
        );
      } else {
        consulta = consulta
          .gte("created_at", fechaLimite.toISOString())
          .lte("created_at", fechaActual.toISOString());
      }

      const { data, error } = await consulta;

      if (error) {
        console.error("Error al consultar los casos:", error);

        setEventos([]);
        setReporteGenerado(false);
        setUltimaActualizacion(null);
        setMensaje(
          "No fue posible consultar los casos. Verifica los permisos de acceso en Supabase."
        );

        return;
      }

      let resultados = (data || []) as Evento[];

      if (tipoEvento !== "ambos") {
        resultados = resultados.filter(
          (evento) => evento.tipo?.toLowerCase() === tipoEvento
        );
      }

      if (tecnicosSeleccionados.length > 0) {
        resultados = resultados.filter(
          (evento) =>
            evento.tecnico_id !== null &&
            tecnicosSeleccionados.includes(evento.tecnico_id)
        );
      }

      if (usuariosSeleccionados.length > 0) {
        resultados = resultados.filter(
          (evento) =>
            evento.reportado_por !== null &&
            usuariosSeleccionados.includes(evento.reportado_por)
        );
      }

      setEventos(resultados);
      setReporteGenerado(true);
      setUltimaActualizacion(new Date().toLocaleTimeString("es-CO"));

      setMensaje(
        resultados.length === 0
          ? "No se encontraron casos para los filtros seleccionados."
          : "Reporte actualizado correctamente."
      );
    } catch (error) {
      console.error("Error inesperado al generar el reporte:", error);

      setEventos([]);
      setReporteGenerado(false);
      setUltimaActualizacion(null);
      setMensaje(
        "Ocurrió un error al generar el reporte. Intenta nuevamente."
      );
    } finally {
      setConsultando(false);
    }
  }, [
    periodo,
    tipoEvento,
    tecnicosSeleccionados,
    usuariosSeleccionados,
  ]);

  // ACTUALIZACIÓN AUTOMÁTICA SOLO SI YA SE GENERÓ EL REPORTE
  useEffect(() => {
    if (
      cargando ||
      perfil?.role !== "administrador" ||
      !reporteGenerado
    ) {
      return;
    }

    const canal = supabase
      .channel("actualizacion-reportes-tracepyme")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "casos",
        },
        () => {
          void consultarReporte();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [cargando, perfil, reporteGenerado, consultarReporte]);

  // LIMPIAR FILTROS Y RESULTADOS
  function limpiarFiltros() {
    setPeriodo("30");
    setTipoEvento("ambos");
    setTecnicosSeleccionados([]);
    setUsuariosSeleccionados([]);

    setTecnicosAbierto(false);
    setUsuariosAbierto(false);

    setEventos([]);
    setReporteGenerado(false);
    setUltimaActualizacion(null);
    setMensaje(
      "Selecciona los filtros y pulsa Actualizar reporte."
    );
  }

  // INICIALES DEL USUARIO
  const iniciales = perfil?.full_name
    ? perfil.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join("")
    : "US";

  // INDICADORES
  const totalEventos = reporteGenerado ? eventos.length : 0;

  const eventosSolucionados = reporteGenerado
    ? eventos.filter(
        (evento) => evento.estado?.toLowerCase() === "solucionado"
      ).length
    : 0;

  const eventosPendientes = reporteGenerado
    ? eventos.filter(
        (evento) => evento.estado?.toLowerCase() === "pendiente"
      ).length
    : 0;

  const eventosEnProceso = reporteGenerado
    ? eventos.filter(
        (evento) => evento.estado?.toLowerCase() === "en proceso"
      ).length
    : 0;

  const eventosSinAsignar = reporteGenerado
    ? eventos.filter((evento) => !evento.tecnico_id).length
    : 0;

  const tasaResolucion =
    totalEventos > 0
      ? (eventosSolucionados / totalEventos) * 100
      : 0;

  const incidentes = reporteGenerado
    ? eventos.filter(
        (evento) => evento.tipo?.toLowerCase() === "incidente"
      )
    : [];

  const requerimientos = reporteGenerado
    ? eventos.filter(
        (evento) => evento.tipo?.toLowerCase() === "requerimiento"
      )
    : [];

  // PRIORIDADES
  const prioridadBaja = reporteGenerado
    ? eventos.filter(
        (evento) => evento.prioridad?.toLowerCase() === "baja"
      ).length
    : 0;

  const prioridadMedia = reporteGenerado
    ? eventos.filter(
        (evento) => evento.prioridad?.toLowerCase() === "media"
      ).length
    : 0;

  const prioridadAlta = reporteGenerado
    ? eventos.filter(
        (evento) => evento.prioridad?.toLowerCase() === "alta"
      ).length
    : 0;

  // TIEMPO PROMEDIO DE SOLUCIÓN
  const casosConSolucion = reporteGenerado
    ? eventos.filter(
        (evento) =>
          evento.estado?.toLowerCase() === "solucionado" &&
          evento.fecha_solucion
      )
    : [];

  const tiempoPromedioHoras =
    casosConSolucion.length > 0
      ? casosConSolucion.reduce((total, evento) => {
          const inicio = new Date(evento.created_at).getTime();
          const fin = new Date(evento.fecha_solucion!).getTime();

          return total + Math.max(0, fin - inicio) / 3600000;
        }, 0) / casosConSolucion.length
      : 0;

  const tiempoPromedioTexto =
    casosConSolucion.length === 0
      ? "0"
      : tiempoPromedioHoras < 1
        ? `${Math.round(tiempoPromedioHoras * 60)} min`
        : tiempoPromedioHoras < 24
          ? `${tiempoPromedioHoras.toFixed(1)} h`
          : `${(tiempoPromedioHoras / 24).toFixed(1)} días`;

  const porcentaje = (cantidad: number) =>
    totalEventos > 0 ? (cantidad / totalEventos) * 100 : 0;

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Verificando acceso...
      </main>
    );
  }

  const autorizado = perfil?.role === "administrador";

  return (
    <main className="min-h-screen bg-white">
      {/* BARRA SUPERIOR */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-[76px] items-center justify-between bg-[#192f50] px-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="rounded-lg px-3 py-2 text-xl hover:bg-white/10"
            title={menuAbierto ? "Ocultar menú" : "Mostrar menú"}
          >
            ☰
          </button>

          <div>
            <h1 className="text-lg font-bold">TracePYME</h1>

            <p className="hidden text-xs text-slate-300 sm:block">
              Plataforma de trazabilidad para PYMES
            </p>
          </div>
        </div>

        {/* INFORMACIÓN DEL USUARIO */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">
              {perfil?.full_name || "Usuario"}
            </p>

            <p className="text-xs text-slate-300">
              {perfil?.email}
            </p>

            <span className="text-xs font-medium text-blue-200">
              {perfil ? nombresRoles[perfil.role] : ""}
            </span>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
            {iniciales}
          </div>

          <button
            onClick={cerrarSesion}
            className="rounded-lg border border-slate-500 px-3 py-2 text-xs font-medium hover:bg-white/10 sm:text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="flex min-h-screen pt-[76px]">
        {/* PANEL LATERAL */}
        {menuAbierto && (
          <aside className="fixed bottom-0 left-0 top-[76px] z-20 flex w-56 flex-col border-r border-slate-200 bg-slate-50">
            <nav className="flex-1 space-y-1 px-3 py-4">
              {opcionesMenu.map((opcion) => (
                <button
                  key={opcion.nombre}
                  onClick={() => router.push(opcion.ruta)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                    opcion.nombre === "Reportes"
                      ? "bg-blue-100 font-semibold text-blue-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                  }`}
                >
                  <span className="w-6 text-center text-lg">
                    {opcion.icono}
                  </span>

                  {opcion.nombre}
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <section
          className={`min-w-0 flex-1 bg-white p-5 transition-all duration-300 sm:p-8 ${
            menuAbierto ? "ml-56" : "ml-0"
          }`}
        >
          <div className="mx-auto max-w-7xl">
            {autorizado ? (
              <>
                {/* TÍTULO */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      Reportes
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Consulta y seguimiento de los casos registrados en TracePYME.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Actualización automática
                  </div>
                </div>

                {/* FILTROS */}
                <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-800">
                        Generar reporte
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Selecciona los criterios y pulsa Actualizar reporte.
                      </p>
                    </div>

                    {ultimaActualizacion && (
                      <p className="text-xs text-slate-400">
                        Última actualización: {ultimaActualizacion}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {/* PERIODO */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-600">
                        Periodo
                      </label>

                      <select
                        value={periodo}
                        onChange={(e) =>
                          setPeriodo(e.target.value as Periodo)
                        }
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="30">Últimos 30 días</option>
                        <option value="3">Últimos 3 meses</option>
                        <option value="6">Últimos 6 meses</option>
                        <option value="12">Último año</option>
                        <option value="mas12">Más de un año</option>
                      </select>
                    </div>

                    {/* TIPO DE EVENTO */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-600">
                        Tipo de evento
                      </label>

                      <select
                        value={tipoEvento}
                        onChange={(e) => setTipoEvento(e.target.value)}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="ambos">
                          Incidentes y requerimientos
                        </option>
                        <option value="incidente">Incidentes</option>
                        <option value="requerimiento">Requerimientos</option>
                      </select>
                    </div>

                    {/* TÉCNICOS */}
                    <SelectorPersonas
                      titulo="Técnico"
                      personas={tecnicos}
                      seleccionados={tecnicosSeleccionados}
                      abierto={tecnicosAbierto}
                      setAbierto={(valor) => {
                        setTecnicosAbierto(valor);
                        if (valor) setUsuariosAbierto(false);
                      }}
                      cambiarSeleccion={cambiarTecnico}
                    />

                    {/* USUARIOS */}
                    <SelectorPersonas
                      titulo="Usuario reportante"
                      personas={usuarios}
                      seleccionados={usuariosSeleccionados}
                      abierto={usuariosAbierto}
                      setAbierto={(valor) => {
                        setUsuariosAbierto(valor);
                        if (valor) setTecnicosAbierto(false);
                      }}
                      cambiarSeleccion={cambiarUsuario}
                    />
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => void consultarReporte()}
                      disabled={consultando}
                      className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {consultando ? "Consultando..." : "Actualizar reporte"}
                    </button>

                    <button
                      onClick={limpiarFiltros}
                      disabled={consultando}
                      className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                </div>

                {/* INDICADORES PRINCIPALES */}
                <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Total de eventos
                    </p>

                    <p className="mt-3 text-3xl font-bold text-blue-600">
                      {totalEventos}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      Casos incluidos en el reporte
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Eventos solucionados
                    </p>

                    <p className="mt-3 text-3xl font-bold text-emerald-600">
                      {eventosSolucionados}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      Casos con estado Solucionado
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Eventos pendientes
                    </p>

                    <p className="mt-3 text-3xl font-bold text-orange-600">
                      {eventosPendientes}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      Casos que aún no han iniciado
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Eventos en proceso
                    </p>

                    <p className="mt-3 text-3xl font-bold text-indigo-600">
                      {eventosEnProceso}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      Casos actualmente en gestión
                    </p>
                  </div>
                </div>

                {/* INDICADORES COMPLEMENTARIOS */}
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                      Casos sin asignar
                    </p>

                    <p className="mt-2 text-2xl font-bold text-red-600">
                      {eventosSinAsignar}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      No tienen técnico responsable
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                      Tasa de resolución
                    </p>

                    <p className="mt-2 text-2xl font-bold text-emerald-600">
                      {tasaResolucion.toFixed(1)}%
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Porcentaje de casos solucionados
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                      Tiempo promedio de solución
                    </p>

                    <p className="mt-2 text-2xl font-bold text-blue-600">
                      {tiempoPromedioTexto}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Desde la creación hasta la solución
                    </p>
                  </div>
                </div>

                {/* DISTRIBUCIÓN POR TIPO */}
                <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="font-bold text-slate-800">
                    Distribución por tipo de evento
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Comparación entre incidentes y requerimientos.
                  </p>

                  <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="rounded-lg bg-blue-50 p-5">
                      <p className="text-sm font-medium text-blue-700">
                        Incidentes
                      </p>

                      <p className="mt-2 text-3xl font-bold text-blue-700">
                        {incidentes.length}
                      </p>

                      <p className="mt-1 text-xs text-blue-600">
                        {totalEventos > 0
                          ? `${((incidentes.length / totalEventos) * 100).toFixed(1)}% del total`
                          : "0% del total"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-emerald-50 p-5">
                      <p className="text-sm font-medium text-emerald-700">
                        Requerimientos
                      </p>

                      <p className="mt-2 text-3xl font-bold text-emerald-700">
                        {requerimientos.length}
                      </p>

                      <p className="mt-1 text-xs text-emerald-600">
                        {totalEventos > 0
                          ? `${((requerimientos.length / totalEventos) * 100).toFixed(1)}% del total`
                          : "0% del total"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    {totalEventos > 0 && (
                      <>
                        <div
                          className="bg-blue-500 transition-all"
                          style={{
                            width: `${(incidentes.length / totalEventos) * 100}%`,
                          }}
                        />

                        <div
                          className="bg-emerald-500 transition-all"
                          style={{
                            width: `${(requerimientos.length / totalEventos) * 100}%`,
                          }}
                        />
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-500">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-blue-500" />
                      Incidentes
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                      Requerimientos
                    </span>
                  </div>
                </div>

                {/* DISTRIBUCIÓN POR PRIORIDAD */}
                <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="font-bold text-slate-800">
                    Distribución por prioridad
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Cantidad de casos según su nivel de prioridad.
                  </p>

                  <div className="mt-6 space-y-5">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600">
                          Alta
                        </span>

                        <span className="font-semibold text-orange-600">
                          {prioridadAlta}
                        </span>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-all"
                          style={{ width: `${porcentaje(prioridadAlta)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600">
                          Media
                        </span>

                        <span className="font-semibold text-yellow-600">
                          {prioridadMedia}
                        </span>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-yellow-400 transition-all"
                          style={{ width: `${porcentaje(prioridadMedia)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600">
                          Baja
                        </span>

                        <span className="font-semibold text-green-600">
                          {prioridadBaja}
                        </span>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${porcentaje(prioridadBaja)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* TABLA DE CASOS */}
                <div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-5 sm:p-6">
                    <h3 className="font-bold text-slate-800">
                      Casos incluidos en el reporte
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Se muestran los 10 casos más recientes que cumplen los filtros.
                    </p>
                  </div>

                  {eventos.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-5 py-4">Código</th>
                            <th className="px-5 py-4">Asunto</th>
                            <th className="px-5 py-4">Tipo</th>
                            <th className="px-5 py-4">Prioridad</th>
                            <th className="px-5 py-4">Estado</th>
                            <th className="px-5 py-4">Fecha</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {eventos.slice(0, 10).map((evento) => (
                            <tr
                              key={evento.id}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="whitespace-nowrap px-5 py-4 font-semibold text-blue-700">
                                {evento.codigo}
                              </td>

                              <td className="max-w-[260px] px-5 py-4 text-slate-700">
                                <span className="block truncate">
                                  {evento.asunto}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                                {evento.tipo === "incidente"
                                  ? "Incidente"
                                  : "Requerimiento"}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    evento.prioridad === "Alta"
                                      ? "bg-orange-100 text-orange-700"
                                      : evento.prioridad === "Media"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {evento.prioridad || "Sin prioridad"}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-5 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    evento.estado === "Solucionado"
                                      ? "bg-green-100 text-green-700"
                                      : evento.estado === "En proceso"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-orange-100 text-orange-700"
                                  }`}
                                >
                                  {evento.estado}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                                {new Date(evento.created_at).toLocaleDateString(
                                  "es-CO"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <p className="font-medium text-slate-600">
                        {reporteGenerado
                          ? "No hay casos para mostrar."
                          : "Todavía no se ha generado ningún reporte."}
                      </p>

                      <p className="mt-2 text-sm text-slate-400">
                        {reporteGenerado
                          ? "Prueba cambiando los filtros."
                          : "Selecciona los filtros y pulsa Actualizar reporte."}
                      </p>
                    </div>
                  )}

                  {eventos.length > 10 && (
                    <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                      Mostrando 10 de {eventos.length} casos encontrados.
                    </div>
                  )}
                </div>

                {/* MENSAJE DE RESULTADO */}
                <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg text-blue-600">ℹ</span>

                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Estado del reporte
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {consultando
                          ? "Consultando información..."
                          : mensaje}
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        {reporteGenerado
                          ? "Los resultados se actualizarán automáticamente cuando cambien los casos en Supabase."
                          : "Los indicadores permanecerán en cero hasta que generes un reporte."}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* ACCESO NO AUTORIZADO */
              <div className="flex min-h-[65vh] items-center justify-center">
                <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
                    !
                  </div>

                  <h2 className="mt-5 text-xl font-bold text-slate-800">
                    Acceso no autorizado
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    No tienes permisos para consultar la página de Reportes.
                    Esta sección está disponible únicamente para el
                    administrador de TracePYME.
                  </p>

                  <button
                    onClick={() => router.push("/resumen")}
                    className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Volver al resumen
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

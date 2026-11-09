
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Perfil = {
  email: string;
  full_name: string | null;
  role: "administrador" | "tecnico" | "usuario";
};

type Caso = {
  id: string;
  codigo: string;
  tipo: string;
  asunto: string;
  categoria: string | null;
  prioridad: string;
  estado: string;
  created_at: string;
  fecha_solucion: string | null;
  tecnico_id: string | null;
};

type ActividadMensual = {
  nombre: string;
  incidentes: number;
  requerimientos: number;
  total: number;
};

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

const meses = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export default function Analitica() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(true);
  const [fechaActual, setFechaActual] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const autorizado =
    perfil?.role === "administrador" ||
    perfil?.role === "tecnico";

  // Consultar los casos registrados en Supabase.
  const cargarCasos = useCallback(async () => {
    setActualizando(true);
    setError("");

    try {
      const { data, error: errorCasos } = await supabase
        .from("casos")
        .select(
          "id, codigo, tipo, asunto, categoria, prioridad, estado, created_at, fecha_solucion, tecnico_id"
        )
        .order("created_at", { ascending: false });

      if (errorCasos) throw errorCasos;

      setCasos((data || []) as Caso[]);
    } catch (err) {
      console.error("Error al consultar los casos:", err);

      setError(
        err instanceof Error
          ? err.message
          : "No fue posible actualizar la analítica."
      );
    } finally {
      setActualizando(false);
      setCargando(false);
    }
  }, []);

  // Verificar sesión, cargar perfil y configurar actualización automática.
  useEffect(() => {
    let activo = true;

    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function iniciarPagina() {
      try {
        const {
          data: { user },
          error: errorUsuario,
        } = await supabase.auth.getUser();

        if (!activo) return;

        if (errorUsuario || !user) {
          router.replace("/");
          return;
        }

        const { data: datosPerfil, error: errorPerfil } =
          await supabase
            .from("profiles")
            .select("email, full_name, role")
            .eq("id", user.id)
            .single();

        if (!activo) return;

        if (errorPerfil || !datosPerfil) {
          console.error(
            "Error al cargar el perfil:",
            errorPerfil
          );

          await supabase.auth.signOut();
          router.replace("/");
          return;
        }

        setPerfil(datosPerfil as Perfil);
        setFechaActual(new Date());

        // Solo administradores y técnicos pueden consultar los datos.
        if (
          datosPerfil.role !== "administrador" &&
          datosPerfil.role !== "tecnico"
        ) {
          setCargando(false);
          return;
        }

        // Primera consulta.
        await cargarCasos();

        if (!activo) return;

        // Actualización automática cuando cambien los casos.
        canal = supabase
          .channel("actualizacion-analitica-tracepyme")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "casos",
            },
            () => {
              void cargarCasos();
            }
          )
          .subscribe();
      } catch (err) {
        console.error(err);

        if (activo) {
          setError("No fue posible iniciar la página de analítica.");
          setCargando(false);
        }
      }
    }

    void iniciarPagina();

    return () => {
      activo = false;

      if (canal) {
        void supabase.removeChannel(canal);
      }
    };
  }, [router, cargarCasos]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const iniciales = perfil?.full_name
    ? perfil.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join("")
    : "US";

  // Clasificación de los casos.
  const incidentes = casos.filter(
    (caso) => caso.tipo === "incidente"
  );

  const requerimientos = casos.filter(
    (caso) => caso.tipo === "requerimiento"
  );

  const totalCasos = casos.length;

  const totalIncidentes = incidentes.length;

  const totalRequerimientos = requerimientos.length;

  const casosSolucionados = casos.filter(
    (caso) => caso.estado === "Solucionado"
  );

  const incidentesSolucionados = incidentes.filter(
    (caso) => caso.estado === "Solucionado"
  );

  const requerimientosSolucionados = requerimientos.filter(
    (caso) => caso.estado === "Solucionado"
  );

  const casosEnProceso = casos.filter(
    (caso) => caso.estado === "En proceso"
  );

  const casosPendientes = casos.filter(
    (caso) => caso.estado === "Pendiente"
  );

  const casosSinAsignar = casos.filter(
    (caso) => !caso.tecnico_id
  );

  // Calcular la tasa de resolución.
  function calcularTasa(
    solucionados: number,
    total: number
  ) {
    if (total === 0) return 0;

    return Math.round((solucionados / total) * 100);
  }

  const tasaIncidentes = calcularTasa(
    incidentesSolucionados.length,
    totalIncidentes
  );

  const tasaRequerimientos = calcularTasa(
    requerimientosSolucionados.length,
    totalRequerimientos
  );

  // Calcular el tiempo promedio entre creación y solución.
  function calcularTiempoPromedio(lista: Caso[]) {
    const casosConFecha = lista.filter(
      (caso) =>
        caso.estado === "Solucionado" &&
        caso.fecha_solucion &&
        caso.created_at
    );

    if (casosConFecha.length === 0) return null;

    const tiempos = casosConFecha.map((caso) => {
      const inicio = new Date(caso.created_at).getTime();
      const fin = new Date(caso.fecha_solucion!).getTime();

      return Math.max(0, fin - inicio);
    });

    const promedio =
      tiempos.reduce((total, tiempo) => total + tiempo, 0) /
      tiempos.length;

    return promedio / (1000 * 60);
  }

  function formatoDuracion(minutos: number | null) {
    if (minutos === null) return "—";

    if (minutos < 1) return "Menos de 1 min";

    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    const minutosRestantes = Math.round(minutos % 60);

    if (dias > 0) {
      return `${dias} d ${horasRestantes} h`;
    }

    if (horas > 0) {
      return `${horas} h ${minutosRestantes} min`;
    }

    return `${minutosRestantes} min`;
  }

  const tiempoIncidentes = calcularTiempoPromedio(incidentes);

  const tiempoRequerimientos =
    calcularTiempoPromedio(requerimientos);

  // Eventos registrados durante los últimos 30 días.
  const eventosPeriodo = fechaActual
    ? casos.filter((caso) => {
        const fecha = new Date(caso.created_at).getTime();

        const limite =
          fechaActual.getTime() - 30 * 24 * 60 * 60 * 1000;

        return (
          fecha >= limite &&
          fecha <= fechaActual.getTime()
        );
      })
    : [];

  const incidentesPeriodo = eventosPeriodo.filter(
    (caso) => caso.tipo === "incidente"
  ).length;

  const requerimientosPeriodo = eventosPeriodo.filter(
    (caso) => caso.tipo === "requerimiento"
  ).length;

  // Actividad mensual de los últimos seis meses.
  const actividadMensual: ActividadMensual[] = fechaActual
    ? Array.from({ length: 6 }, (_, indice) => {
        const fecha = new Date(fechaActual);

        fecha.setDate(1);
        fecha.setMonth(fecha.getMonth() - (5 - indice));

        const anio = fecha.getFullYear();
        const mes = fecha.getMonth();

        const casosDelMes = casos.filter((caso) => {
          const fechaCaso = new Date(caso.created_at);

          return (
            fechaCaso.getFullYear() === anio &&
            fechaCaso.getMonth() === mes
          );
        });

        return {
          nombre: meses[mes],
          incidentes: casosDelMes.filter(
            (caso) => caso.tipo === "incidente"
          ).length,
          requerimientos: casosDelMes.filter(
            (caso) => caso.tipo === "requerimiento"
          ).length,
          total: casosDelMes.length,
        };
      })
    : [];

  const maxActividad = Math.max(
    1,
    ...actividadMensual.map((mes) => mes.total)
  );

  // Distribución por categoría.
  const categorias = Array.from(
    new Set(
      casos.map((caso) => caso.categoria || "Sin categoría")
    )
  )
    .map((categoria) => {
      const registros = casos.filter(
        (caso) =>
          (caso.categoria || "Sin categoría") === categoria
      );

      return {
        nombre: categoria,
        incidentes: registros.filter(
          (caso) => caso.tipo === "incidente"
        ).length,
        requerimientos: registros.filter(
          (caso) => caso.tipo === "requerimiento"
        ).length,
        total: registros.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const maxCategoria = Math.max(
    1,
    ...categorias.map((categoria) => categoria.total)
  );

  // Distribución por prioridad.
  const prioridades = [
    {
      nombre: "Alta",
      color: "bg-orange-500",
      texto: "text-orange-700",
    },
    {
      nombre: "Media",
      color: "bg-yellow-400",
      texto: "text-yellow-700",
    },
    {
      nombre: "Baja",
      color: "bg-green-500",
      texto: "text-green-700",
    },
  ].map((prioridad) => ({
    ...prioridad,
    total: casos.filter(
      (caso) => caso.prioridad === prioridad.nombre
    ).length,
  }));

  const maxPrioridad = Math.max(
    1,
    ...prioridades.map((prioridad) => prioridad.total)
  );

  // Distribución por estado.
  const estados = [
    {
      nombre: "Pendiente",
      color: "bg-orange-500",
      total: casosPendientes.length,
    },
    {
      nombre: "En proceso",
      color: "bg-blue-600",
      total: casosEnProceso.length,
    },
    {
      nombre: "Solucionado",
      color: "bg-green-500",
      total: casosSolucionados.length,
    },
  ];

  // Porcentajes de distribución.
  function porcentaje(valor: number, total: number) {
    if (total === 0) return 0;

    return Math.round((valor / total) * 100);
  }

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Verificando acceso y consultando información...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* BARRA SUPERIOR - CONSERVADA */}
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
        {/* PANEL LATERAL - CONSERVADO */}
        {menuAbierto && (
          <aside className="fixed bottom-0 left-0 top-[76px] z-20 flex w-56 flex-col border-r border-slate-200 bg-slate-50">
            <nav className="flex-1 space-y-1 px-3 py-4">
              {opcionesMenu.map((opcion) => (
                <button
                  key={opcion.nombre}
                  onClick={() => router.push(opcion.ruta)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                    opcion.nombre === "Analítica"
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      Analítica de datos
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Indicadores clave de rendimiento (KPI)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        actualizando
                          ? "animate-pulse bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    />

                    {actualizando
                      ? "Actualizando..."
                      : "Datos actualizados"}
                  </div>
                </div>

                {error && (
                  <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                    <button
                      onClick={cargarCasos}
                      className="ml-2 font-semibold underline"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {/* INDICADORES PRINCIPALES */}
                <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {/* TIEMPO PROMEDIO */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-500">
                        Tiempo promedio de atención
                      </p>
                      <span className="text-xl">◷</span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          Incidentes
                        </p>
                        <p className="mt-2 text-xl font-bold text-blue-600">
                          {formatoDuracion(tiempoIncidentes)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Requerimientos
                        </p>
                        <p className="mt-2 text-xl font-bold text-emerald-600">
                          {formatoDuracion(tiempoRequerimientos)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                      Calculado sobre casos solucionados.
                    </p>
                  </div>

                  {/* TASA DE RESOLUCIÓN */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-500">
                        Tasa de resolución
                      </p>
                      <span className="text-xl">✓</span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          Incidentes
                        </p>
                        <p className="mt-2 text-2xl font-bold text-blue-600">
                          {tasaIncidentes}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Requerimientos
                        </p>
                        <p className="mt-2 text-2xl font-bold text-emerald-600">
                          {tasaRequerimientos}%
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                      Casos solucionados sobre el total registrado.
                    </p>
                  </div>

                  {/* EVENTOS DEL PERIODO */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-500">
                        Eventos últimos 30 días
                      </p>
                      <span className="text-xl">▥</span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          Incidentes
                        </p>
                        <p className="mt-2 text-2xl font-bold text-blue-600">
                          {incidentesPeriodo}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Requerimientos
                        </p>
                        <p className="mt-2 text-2xl font-bold text-emerald-600">
                          {requerimientosPeriodo}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Total del periodo
                        </span>
                        <span className="text-xl font-bold text-slate-800">
                          {eventosPeriodo.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CASOS SIN ASIGNAR */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-500">
                        Casos sin asignar
                      </p>
                      <span className="text-xl">♙</span>
                    </div>

                    <p className="mt-4 text-3xl font-bold text-orange-500">
                      {casosSinAsignar.length}
                    </p>

                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">
                          Incidentes
                        </span>
                        <span className="font-semibold text-blue-600">
                          {
                            casosSinAsignar.filter(
                              (caso) => caso.tipo === "incidente"
                            ).length
                          }
                        </span>
                      </div>

                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">
                          Requerimientos
                        </span>
                        <span className="font-semibold text-emerald-600">
                          {
                            casosSinAsignar.filter(
                              (caso) => caso.tipo === "requerimiento"
                            ).length
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RESUMEN GENERAL */}
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-slate-800">
                    Resumen general de casos
                  </h3>

                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">
                        Total registrados
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-800">
                        {totalCasos}
                      </p>
                    </div>

                    <div className="rounded-lg bg-orange-50 p-4">
                      <p className="text-xs text-orange-700">
                        Pendientes
                      </p>
                      <p className="mt-2 text-2xl font-bold text-orange-600">
                        {casosPendientes.length}
                      </p>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-4">
                      <p className="text-xs text-blue-700">
                        En proceso
                      </p>
                      <p className="mt-2 text-2xl font-bold text-blue-600">
                        {casosEnProceso.length}
                      </p>
                    </div>

                    <div className="rounded-lg bg-green-50 p-4">
                      <p className="text-xs text-green-700">
                        Solucionados
                      </p>
                      <p className="mt-2 text-2xl font-bold text-green-600">
                        {casosSolucionados.length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* GRÁFICOS */}
                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {/* VOLUMEN DE EVENTOS */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
                    <h3 className="font-bold text-slate-700">
                      Volumen de eventos
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Comparación mensual de los últimos seis meses.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-blue-600" />
                        <span className="text-slate-600">
                          Incidentes
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                        <span className="text-slate-600">
                          Requerimientos
                        </span>
                      </div>
                    </div>

                    {totalCasos === 0 ? (
                      <div className="flex h-64 items-center justify-center text-center text-sm text-slate-400">
                        Todavía no hay casos registrados.
                      </div>
                    ) : (
                      <div className="mt-6 flex h-64 items-end justify-around gap-2 border-b border-slate-200 px-2">
                        {actividadMensual.map((mes) => {
                          const alturaIncidentes =
                            (mes.incidentes / maxActividad) * 190;

                          const alturaRequerimientos =
                            (mes.requerimientos / maxActividad) * 190;

                          return (
                            <div
                              key={mes.nombre}
                              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                            >
                              <p className="mb-2 text-xs font-semibold text-slate-600">
                                {mes.total}
                              </p>

                              <div className="flex h-[190px] w-full items-end justify-center gap-1">
                                <div
                                  title={`Incidentes: ${mes.incidentes}`}
                                  className="w-5 max-w-[40%] rounded-t bg-blue-600 transition-all"
                                  style={{
                                    height: `${alturaIncidentes}px`,
                                    minHeight:
                                      mes.incidentes > 0 ? "3px" : "0px",
                                  }}
                                />

                                <div
                                  title={`Requerimientos: ${mes.requerimientos}`}
                                  className="w-5 max-w-[40%] rounded-t bg-emerald-500 transition-all"
                                  style={{
                                    height: `${alturaRequerimientos}px`,
                                    minHeight:
                                      mes.requerimientos > 0 ? "3px" : "0px",
                                  }}
                                />
                              </div>

                              <p className="mt-2 text-xs text-slate-500">
                                {mes.nombre}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ESTADOS */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="font-bold text-slate-700">
                      Casos por estado
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Distribución según el estado actual.
                    </p>

                    <div className="mt-7 space-y-6">
                      {estados.map((estado) => (
                        <div key={estado.nombre}>
                          <div className="mb-2 flex justify-between text-sm">
                            <span className="text-slate-600">
                              {estado.nombre}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {estado.total}
                            </span>
                          </div>

                          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${estado.color} transition-all`}
                              style={{
                                width: `${porcentaje(
                                  estado.total,
                                  totalCasos
                                )}%`,
                              }}
                            />
                          </div>

                          <p className="mt-1 text-right text-xs text-slate-400">
                            {porcentaje(estado.total, totalCasos)}%
                          </p>
                        </div>
                      ))}
                    </div>

                    {totalCasos === 0 && (
                      <p className="mt-6 text-center text-xs text-slate-400">
                        Sin datos disponibles.
                      </p>
                    )}
                  </div>
                </div>

                {/* CATEGORÍAS Y PRIORIDADES */}
                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {/* CATEGORÍAS */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="font-bold text-slate-700">
                      Eventos por categoría
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Distribución de incidentes y requerimientos.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-blue-600" />
                        <span className="text-slate-600">
                          Incidentes
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                        <span className="text-slate-600">
                          Requerimientos
                        </span>
                      </div>
                    </div>

                    {categorias.length === 0 ? (
                      <p className="py-12 text-center text-sm text-slate-400">
                        Todavía no hay categorías registradas.
                      </p>
                    ) : (
                      <div className="mt-6 space-y-5">
                        {categorias.map((categoria) => (
                          <div key={categoria.nombre}>
                            <div className="mb-2 flex justify-between gap-3 text-sm">
                              <span className="font-medium text-slate-700">
                                {categoria.nombre}
                              </span>

                              <span className="text-slate-500">
                                {categoria.total}
                              </span>
                            </div>

                            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-blue-600 transition-all"
                                style={{
                                  width: `${
                                    (categoria.incidentes /
                                      maxCategoria) *
                                    100
                                  }%`,
                                }}
                                title={`Incidentes: ${categoria.incidentes}`}
                              />

                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{
                                  width: `${
                                    (categoria.requerimientos /
                                      maxCategoria) *
                                    100
                                  }%`,
                                }}
                                title={`Requerimientos: ${categoria.requerimientos}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PRIORIDADES */}
                  <div className="rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="font-bold text-slate-700">
                      Casos por prioridad
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Distribución según el nivel de prioridad.
                    </p>

                    <div className="mt-6 space-y-6">
                      {prioridades.map((prioridad) => (
                        <div key={prioridad.nombre}>
                          <div className="mb-2 flex justify-between text-sm">
                            <span
                              className={`font-medium ${prioridad.texto}`}
                            >
                              {prioridad.nombre}
                            </span>

                            <span className="font-semibold text-slate-700">
                              {prioridad.total}
                            </span>
                          </div>

                          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${prioridad.color} transition-all`}
                              style={{
                                width: `${
                                  (prioridad.total / maxPrioridad) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalCasos === 0 && (
                      <p className="mt-6 text-center text-xs text-slate-400">
                        Sin datos disponibles.
                      </p>
                    )}
                  </div>
                </div>

                {/* TABLA DE CASOS RECIENTES */}
                <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
                    <div>
                      <h3 className="font-bold text-slate-700">
                        Casos registrados recientemente
                      </h3>

                      <p className="mt-1 text-xs text-slate-400">
                        Últimos diez incidentes y requerimientos.
                      </p>
                    </div>

                    <button
                      onClick={cargarCasos}
                      disabled={actualizando}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Actualizar datos
                    </button>
                  </div>

                  {casos.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">
                      No hay casos registrados para mostrar.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-5 py-3">Código</th>
                            <th className="px-5 py-3">Tipo</th>
                            <th className="px-5 py-3">Asunto</th>
                            <th className="px-5 py-3">Prioridad</th>
                            <th className="px-5 py-3">Estado</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {casos.slice(0, 10).map((caso) => (
                            <tr
                              key={caso.id}
                              className="hover:bg-slate-50"
                            >
                              <td className="px-5 py-4 font-semibold text-blue-700">
                                {caso.codigo}
                              </td>

                              <td className="px-5 py-4 text-slate-600">
                                {caso.tipo === "incidente"
                                  ? "Incidente"
                                  : "Requerimiento"}
                              </td>

                              <td className="max-w-[250px] truncate px-5 py-4 text-slate-700">
                                {caso.asunto}
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    caso.prioridad === "Alta"
                                      ? "bg-orange-100 text-orange-700"
                                      : caso.prioridad === "Media"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {caso.prioridad}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    caso.estado === "Solucionado"
                                      ? "bg-green-100 text-green-700"
                                      : caso.estado === "En proceso"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-orange-100 text-orange-700"
                                  }`}
                                >
                                  {caso.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <p className="mt-5 text-center text-xs text-slate-400">
                  Los indicadores se calculan con los registros
                  disponibles en TracePYME y se actualizan cuando
                  Supabase notifica cambios en la tabla de casos.
                </p>
              </>
            ) : (
              /* MENSAJE PARA USUARIOS SIN AUTORIZACIÓN */
              <div className="flex min-h-[65vh] items-center justify-center">
                <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
                    !
                  </div>

                  <h2 className="mt-5 text-xl font-bold text-slate-800">
                    Acceso no autorizado
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    No tienes permisos para consultar la página de
                    Analítica. Esta sección está disponible únicamente
                    para los administradores y técnicos de TracePYME.
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

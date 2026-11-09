
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  email: string;
  full_name: string | null;
  role: "administrador" | "tecnico" | "usuario";
};

type Incidente = {
  codigo: string;
  asunto: string;
  prioridad: "Baja" | "Media" | "Alta" | "Crítica";
  estado: "Pendiente" | "En proceso" | "Resuelto" | "Solucionado";
  fecha: string;
  responsable: string;
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

function colorPrioridad(prioridad: Incidente["prioridad"]) {
  switch (prioridad) {
    case "Alta":
      return "text-orange-600 font-bold";
    case "Crítica":
      return "text-red-600 font-bold";
    case "Media":
      return "text-yellow-600 font-semibold";
    case "Baja":
      return "text-green-600 font-medium";
    default:
      return "text-slate-600 font-medium";
  }
}

function colorEstado(estado: Incidente["estado"]) {
  switch (estado) {
    case "Pendiente":
      return {
        clase: "text-orange-600 font-bold",
        nombre: "Pendiente",
      };

    case "Resuelto":
    case "Solucionado":
      return {
        clase: "text-green-600 font-bold",
        nombre: "Solucionado",
      };

    case "En proceso":
      return {
        clase: "text-blue-600 font-semibold",
        nombre: "En proceso",
      };

    default:
      return {
        clase: "text-slate-600 font-medium",
        nombre: estado,
      };
  }
}

export default function Incidentes() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoIncidentes, setCargandoIncidentes] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);

  // Cargar incidentes y consultar el nombre de sus responsables.
  async function cargarIncidentes(
    usuarioId?: string,
    rol?: Perfil["role"]
  ) {
    const idActual = usuarioId || perfil?.id;
    const rolActual = rol || perfil?.role;

    if (!idActual || !rolActual) return;

    setCargandoIncidentes(true);
    setErrorCarga("");

    let consulta = supabase
      .from("casos")
      .select(
        "codigo, asunto, prioridad, estado, created_at, reportado_por, tecnico_id"
      )
      .eq("tipo", "incidente")
      .order("created_at", { ascending: false });

    // Los usuarios normales solo ven los incidentes
    // reportados a su nombre.
    if (rolActual === "usuario") {
      consulta = consulta.eq("reportado_por", idActual);
    }

    const { data, error } = await consulta;

    if (error) {
      console.error("Error al cargar incidentes:", error);
      setErrorCarga(
        "No fue posible cargar los incidentes. Verifica los permisos de acceso."
      );
      setCargandoIncidentes(false);
      return;
    }

    // Obtener los identificadores de los responsables asignados.
    const idsResponsables = Array.from(
      new Set(
        (data || [])
          .map((incidente) => incidente.tecnico_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    // Consultar los nombres de los responsables en profiles.
    let responsables: { id: string; full_name: string | null; email: string }[] =
      [];

    if (idsResponsables.length > 0) {
      const { data: datosResponsables, error: errorResponsables } =
        await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", idsResponsables);

      if (errorResponsables) {
        console.error(
          "Error al consultar los responsables:",
          errorResponsables
        );
      } else {
        responsables = datosResponsables || [];
      }
    }

    // Relacionar cada incidente con el nombre de su responsable.
    const registros: Incidente[] = (data || []).map((incidente) => {
      const responsableEncontrado = responsables.find(
        (persona) => persona.id === incidente.tecnico_id
      );

      return {
        codigo: incidente.codigo,
        asunto: incidente.asunto,
        prioridad: incidente.prioridad,
        estado: incidente.estado,
        fecha: new Date(incidente.created_at).toLocaleDateString("es-CO"),
        responsable: incidente.tecnico_id
          ? responsableEncontrado?.full_name?.trim() ||
            responsableEncontrado?.email ||
            "Responsable no disponible"
          : "Sin asignar",
      };
    });

    setIncidentes(registros);
    setCargandoIncidentes(false);
  }

  // Verificar sesión y cargar perfil.
  useEffect(() => {
    async function cargarPerfil() {
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

      const perfilActual = datosPerfil as Perfil;

      setPerfil(perfilActual);

      await cargarIncidentes(perfilActual.id, perfilActual.role);

      setCargando(false);
    }

    void cargarPerfil();
  }, [router]);

  // Cerrar sesión.
  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  // Iniciales del usuario.
  const iniciales = perfil?.full_name
    ? perfil.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join("")
    : "US";

  // Buscar por código, asunto o responsable.
  const incidentesFiltrados = incidentes.filter((incidente) => {
    const texto = busqueda.toLowerCase();

    return (
      incidente.codigo.toLowerCase().includes(texto) ||
      incidente.asunto.toLowerCase().includes(texto) ||
      incidente.responsable.toLowerCase().includes(texto)
    );
  });

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Verificando acceso...
      </main>
    );
  }

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

        {/* INFORMACIÓN DE LA CUENTA */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">
              {perfil?.full_name || "Usuario"}
            </p>

            <p className="text-xs text-slate-300">{perfil?.email}</p>

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
                    opcion.nombre === "Incidentes"
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
            {/* TÍTULO */}
            <h2 className="text-2xl font-bold text-slate-900">
              Incidentes
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Registro y seguimiento de incidentes
            </p>

            {/* BOTÓN Y BUSCADOR */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/incidentes/nuevo")}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                + Nuevo incidente
              </button>

              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por código, asunto o responsable..."
                className="w-full max-w-md rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <button
                onClick={() => cargarIncidentes()}
                disabled={cargandoIncidentes}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {cargandoIncidentes ? "Actualizando..." : "↻ Actualizar"}
              </button>
            </div>

            {/* MENSAJE DE ERROR */}
            {errorCarga && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorCarga}
              </div>
            )}

            {/* TABLA DE INCIDENTES */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs font-semibold text-slate-600">
                    <th className="rounded-l-lg px-4 py-4">Código</th>
                    <th className="px-4 py-4">Asunto</th>
                    <th className="px-4 py-4">Responsable</th>
                    <th className="px-4 py-4">Prioridad</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="rounded-r-lg px-4 py-4">Fecha</th>
                  </tr>
                </thead>

                <tbody>
                  {incidentesFiltrados.map((incidente) => {
                    const estado = colorEstado(incidente.estado);

                    return (
                      <tr
                        key={incidente.codigo}
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-5">
                          <button
                            onClick={() =>
                              router.push(
                                `/incidentes/${encodeURIComponent(incidente.codigo)}`
                              )
                            }
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            title="Abrir y gestionar incidente"
                          >
                            {incidente.codigo}
                          </button>
                        </td>

                        <td className="px-4 py-5 text-slate-700">
                          {incidente.asunto}
                        </td>

                        <td className="px-4 py-5 text-slate-600">
                          {incidente.responsable}
                        </td>

                        <td className="px-4 py-5">
                          <span className={colorPrioridad(incidente.prioridad)}>
                            {incidente.prioridad}
                          </span>
                        </td>

                        <td className="px-4 py-5">
                          <span className={estado.clase}>
                            {estado.nombre}
                          </span>
                        </td>

                        <td className="px-4 py-5 text-slate-500">
                          {incidente.fecha}
                        </td>
                      </tr>
                    );
                  })}

                  {incidentesFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-400"
                      >
                        {cargandoIncidentes
                          ? "Cargando incidentes..."
                          : busqueda
                            ? "No se encontraron incidentes con esa búsqueda."
                            : "Todavía no hay incidentes registrados."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

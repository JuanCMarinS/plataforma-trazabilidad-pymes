
"use client";

import { useEffect, useState } from "react";
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
  prioridad: string;
  estado: string;
  reportado_por: string;
  tecnico_id: string | null;
  created_at: string;
  fecha_resolucion: string | null;
  resolucion_caso: string | null;
};

type EventoResolucion = {
  id: string;
  caso_id: string;
  resolucion: string;
  fecha_respuesta: string;
  origen: string;
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
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export default function Resumen() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(true);

  const [casos, setCasos] = useState<Caso[]>([]);
  const [eventos, setEventos] = useState<EventoResolucion[]>([]);
  const [errorDatos, setErrorDatos] = useState("");
  const [fechaActual, setFechaActual] = useState<Date | null>(null);

  useEffect(() => {
    setFechaActual(new Date());
  }, []);

  // CARGAR PERFIL, CASOS E HISTORIAL

  useEffect(() => {
    let activo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function iniciarResumen() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          router.replace("/");
          return;
        }

        const { data: datosPerfil, error: errorPerfil } =
          await supabase
            .from("profiles")
            .select("email, full_name, role")
            .eq("id", data.user.id)
            .single();

        if (errorPerfil || !datosPerfil) {
          console.error("Error al cargar el perfil:", errorPerfil);
          await supabase.auth.signOut();
          router.replace("/");
          return;
        }

        if (!activo) return;

        setPerfil(datosPerfil as Perfil);

        async function cargarDatos() {
          const { data: datosCasos, error: errorCasos } =
            await supabase
              .from("casos")
              .select(
                "id, codigo, tipo, asunto, prioridad, estado, reportado_por, tecnico_id, created_at, fecha_resolucion, resolucion_caso"
              )
              .order("created_at", { ascending: false });

          if (errorCasos) {
            console.error("Error al consultar los casos:", errorCasos);

            if (activo) {
              setErrorDatos(
                "No fue posible cargar los casos registrados."
              );
              setCargandoDatos(false);
            }
            return;
          }

          const { data: datosEventos, error: errorEventos } =
            await supabase
              .from("historial_resoluciones")
              .select(
                "id, caso_id, resolucion, fecha_respuesta, origen"
              )
              .order("fecha_respuesta", { ascending: false });

          if (!activo) return;

          if (errorEventos) {
            console.error("Error al consultar el historial:", errorEventos);

            setErrorDatos(
              "Los casos se cargaron, pero no fue posible consultar el historial de resoluciones."
            );
            setEventos([]);
          } else {
            setErrorDatos("");
            setEventos(
              (datosEventos || []) as EventoResolucion[]
            );
          }

          setCasos((datosCasos || []) as Caso[]);
          setCargandoDatos(false);
        }

        await cargarDatos();

        if (!activo) return;

        // ACTUALIZACIÓN AUTOMÁTICA

        canal = supabase
          .channel("actualizacion-resumen-tracepyme")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "casos",
            },
            () => {
              void cargarDatos();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "historial_resoluciones",
            },
            () => {
              void cargarDatos();
            }
          )
          .subscribe((estado) => {
            if (estado === "CHANNEL_ERROR") {
              console.error(
                "No fue posible establecer la actualización automática del resumen."
              );
            }
          });
      } catch (error) {
        console.error("Error al iniciar el resumen:", error);

        if (activo) {
          setErrorDatos(
            "Ocurrió un error al cargar la información."
          );
          setCargandoDatos(false);
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void iniciarResumen();

    return () => {
      activo = false;

      if (canal) {
        void supabase.removeChannel(canal);
      }
    };
  }, [router]);

  // CERRAR SESIÓN

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  function navegar(ruta: string) {
    router.push(ruta);
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

  // CLASIFICACIÓN DE CASOS

  const incidentes = casos.filter(
    (caso) => caso.tipo === "incidente"
  );

  const requerimientos = casos.filter(
    (caso) => caso.tipo === "requerimiento"
  );

  const totalCasos = casos.length;

  // CASOS EN PROCESO

  const incidentesGestion = incidentes.filter(
    (caso) => caso.estado === "En proceso"
  ).length;

  const requerimientosGestion = requerimientos.filter(
    (caso) => caso.estado === "En proceso"
  ).length;

  const totalGestion =
    incidentesGestion + requerimientosGestion;

  // CASOS SOLUCIONADOS

  const incidentesSolucionados = incidentes.filter(
    (caso) => caso.estado === "Solucionado"
  ).length;

  const requerimientosSolucionados = requerimientos.filter(
    (caso) => caso.estado === "Solucionado"
  ).length;

  const totalSolucionados =
    incidentesSolucionados + requerimientosSolucionados;

  // CASOS SIN ASIGNAR

  const incidentesSinAsignar = incidentes.filter(
    (caso) => caso.tecnico_id === null
  ).length;

  const requerimientosSinAsignar = requerimientos.filter(
    (caso) => caso.tecnico_id === null
  ).length;

  const totalSinAsignar =
    incidentesSinAsignar + requerimientosSinAsignar;

  // SATISFACCIÓN Y REAPERTURAS

  const satisfaccionUsuario = eventos.filter(
    (evento) =>
      evento.resolucion === "Satisfecho" &&
      evento.origen === "usuario"
  ).length;

  const satisfaccionVencimiento = eventos.filter(
    (evento) =>
      evento.resolucion ===
        "Satisfecho por vencimiento del plazo" &&
      evento.origen === "sistema"
  ).length;

  const totalReaperturas = eventos.filter(
    (evento) => evento.resolucion === "Reabrir caso"
  ).length;

  // ACTIVIDAD MENSUAL: ÚLTIMOS SEIS MESES

  const actividadMensual = fechaActual
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
          total: casosDelMes.length,
          incidentes: casosDelMes.filter(
            (caso) => caso.tipo === "incidente"
          ).length,
          requerimientos: casosDelMes.filter(
            (caso) => caso.tipo === "requerimiento"
          ).length,
        };
      })
    : [];

  const maxActividad = Math.max(
    1,
    ...actividadMensual.map((mes) => mes.total)
  );

  // PANTALLA DE CARGA

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Verificando acceso...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">

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

        {/* MENÚ LATERAL */}

        {menuAbierto && (
          <aside className="fixed bottom-0 left-0 top-[76px] z-20 flex w-56 flex-col border-r border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Menú principal
              </p>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
              {opcionesMenu.map((opcion) => (
                <button
                  key={opcion.nombre}
                  onClick={() => navegar(opcion.ruta)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                    opcion.nombre === "Resumen"
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-blue-700"
                  }`}
                >
                  <span className="w-6 text-center text-lg">
                    {opcion.icono}
                  </span>
                  {opcion.nombre}
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <p className="text-xs text-slate-400">
                TracePYME
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Sistema de gestión de servicios TI
              </p>
            </div>

          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}

        <section
          className={`min-w-0 flex-1 p-5 transition-all duration-300 sm:p-8 ${
            menuAbierto ? "ml-56" : "ml-0"
          }`}
        >
          <div className="mx-auto max-w-7xl">

            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Panel principal
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              Resumen operativo
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Vista general de los servicios y casos registrados en TracePYME.
            </p>

            {errorDatos && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {errorDatos}
              </div>
            )}

            {/* CUATRO TARJETAS SUPERIORES */}

            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

              {/* EVENTOS REGISTRADOS */}

              <article className="rounded-xl border border-slate-200 border-t-4 border-t-blue-600 bg-white p-4 shadow-sm">

                <p className="text-sm font-medium text-slate-500">
                  Eventos registrados
                </p>

                <h3 className="mt-1 text-2xl font-bold text-blue-600">
                  {cargandoDatos ? "..." : totalCasos}
                </h3>

                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Incidentes</span>
                    <strong className="text-slate-700">
                      {incidentes.length}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Requerimientos</span>
                    <strong className="text-slate-700">
                      {requerimientos.length}
                    </strong>
                  </div>
                </div>

              </article>

              {/* EN PROCESO */}

              <article className="rounded-xl border border-slate-200 border-t-4 border-t-amber-500 bg-white p-4 shadow-sm">

                <p className="text-sm font-medium text-slate-500">
                  En proceso
                </p>

                <h3 className="mt-1 text-2xl font-bold text-amber-500">
                  {cargandoDatos ? "..." : totalGestion}
                </h3>

                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Incidentes</span>
                    <strong className="text-slate-700">
                      {incidentesGestion}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Requerimientos</span>
                    <strong className="text-slate-700">
                      {requerimientosGestion}
                    </strong>
                  </div>
                </div>

              </article>

              {/* SOLUCIONADOS */}

              <article className="rounded-xl border border-slate-200 border-t-4 border-t-emerald-500 bg-white p-4 shadow-sm">

                <p className="text-sm font-medium text-slate-500">
                  Solucionados
                </p>

                <h3 className="mt-1 text-2xl font-bold text-emerald-600">
                  {cargandoDatos ? "..." : totalSolucionados}
                </h3>

                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Incidentes</span>
                    <strong className="text-slate-700">
                      {incidentesSolucionados}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Requerimientos</span>
                    <strong className="text-slate-700">
                      {requerimientosSolucionados}
                    </strong>
                  </div>
                </div>

              </article>

              {/* SIN ASIGNAR */}

              <article className="rounded-xl border border-slate-200 border-t-4 border-t-rose-500 bg-white p-4 shadow-sm">

                <p className="text-sm font-medium text-slate-500">
                  Sin asignar
                </p>

                <h3 className="mt-1 text-2xl font-bold text-rose-600">
                  {cargandoDatos ? "..." : totalSinAsignar}
                </h3>

                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Incidentes</span>
                    <strong className="text-slate-700">
                      {incidentesSinAsignar}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Requerimientos</span>
                    <strong className="text-slate-700">
                      {requerimientosSinAsignar}
                    </strong>
                  </div>
                </div>

              </article>

            </div>

            {/* GRÁFICA Y SATISFACCIÓN */}

            <div className="mt-7 grid gap-5 lg:grid-cols-2">

              {/* ACTIVIDAD MENSUAL */}

              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                <h3 className="font-semibold text-slate-800">
                  Actividad de casos
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Registro mensual de incidentes y requerimientos.
                </p>

                <div className="mt-6 flex h-64 items-end justify-around gap-3 border-b border-slate-200 px-2">

                  {actividadMensual.map((mes) => (
                    <div
                      key={mes.nombre}
                      className="flex h-full flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-2 text-xs font-semibold text-slate-600">
                        {mes.total}
                      </span>

                      <div className="flex h-48 w-full max-w-12 items-end justify-center overflow-hidden rounded-t-md bg-slate-100">
                        <div className="flex w-full flex-col justify-end">

                          <div
                            className="w-full bg-emerald-500 transition-all"
                            style={{
                              height: `${
                                (mes.requerimientos / maxActividad) * 192
                              }px`,
                            }}
                            title={`Requerimientos: ${mes.requerimientos}`}
                          />

                          <div
                            className="w-full bg-blue-600 transition-all"
                            style={{
                              height: `${
                                (mes.incidentes / maxActividad) * 192
                              }px`,
                            }}
                            title={`Incidentes: ${mes.incidentes}`}
                          />

                        </div>
                      </div>

                      <span className="mt-2 text-xs font-medium text-slate-500">
                        {mes.nombre}
                      </span>
                    </div>
                  ))}

                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-5 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-blue-600" />
                    Incidentes
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                    Requerimientos
                  </div>
                </div>

              </article>

              {/* SATISFACCIÓN Y REAPERTURAS */}

              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                <h3 className="font-semibold text-slate-800">
                  Satisfacción y reaperturas
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Resultados de la atención y resolución de los casos.
                </p>

                <div className="mt-7 space-y-6">

                  <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Satisfacción por usuario
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Soluciones aceptadas por los usuarios.
                      </p>
                    </div>

                    <strong className="text-2xl text-emerald-600">
                      {satisfaccionUsuario}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg bg-teal-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Satisfacción por vencimiento
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Casos aceptados automáticamente al vencer el plazo.
                      </p>
                    </div>

                    <strong className="text-2xl text-teal-600">
                      {satisfaccionVencimiento}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg bg-orange-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Reaperturas
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Casos que fueron reabiertos.
                      </p>
                    </div>

                    <strong className="text-2xl text-orange-600">
                      {totalReaperturas}
                    </strong>
                  </div>

                </div>

              </article>

            </div>

            <p className="mt-8 text-center text-xs text-slate-400">
              TracePYME · Plataforma de trazabilidad para PYMES
            </p>

          </div>
        </section>
      </div>
    </main>
  );
}

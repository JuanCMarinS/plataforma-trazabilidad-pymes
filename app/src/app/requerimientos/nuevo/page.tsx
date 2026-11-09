
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Rol = "administrador" | "tecnico" | "usuario";

type Perfil = {
  id: string;
  email: string;
  full_name: string | null;
  role: Rol;
};

const nombresRoles: Record<Rol, string> = {
  administrador: "Administrador",
  tecnico: "Técnico",
  usuario: "Usuario",
};

export default function NuevoRequerimiento() {
  const router = useRouter();
  const selectorRef = useRef<HTMLDivElement>(null);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");

  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridad, setPrioridad] = useState("");

  const [reportadoSeleccionado, setReportadoSeleccionado] = useState("");
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [listaUsuariosAbierta, setListaUsuariosAbierta] = useState(false);

  const puedeSeleccionarReportado =
    perfil?.role === "administrador" || perfil?.role === "tecnico";

  useEffect(() => {
    async function cargarDatos() {
      try {
        const { data: usuarioData, error: errorUsuario } =
          await supabase.auth.getUser();

        if (errorUsuario || !usuarioData.user) {
          router.replace("/");
          return;
        }

        const { data: datosPerfil, error: errorPerfil } = await supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .eq("id", usuarioData.user.id)
          .single();

        if (errorPerfil || !datosPerfil) {
          console.error("Error al cargar el perfil:", errorPerfil);
          await supabase.auth.signOut();
          router.replace("/");
          return;
        }

        const perfilActual = datosPerfil as Perfil;
        setPerfil(perfilActual);

        if (perfilActual.role === "usuario") {
          setReportadoSeleccionado(perfilActual.id);
        } else {
          const { data: listaUsuarios, error: errorUsuarios } =
            await supabase
              .from("profiles")
              .select("id, email, full_name, role")
              .order("full_name", { ascending: true });

          if (errorUsuarios) {
            console.error("Error al cargar usuarios:", errorUsuarios);
            setMensajeError(
              "No fue posible cargar la lista de usuarios. Recarga la página."
            );
          } else {
            setUsuarios((listaUsuarios || []) as Perfil[]);
          }
        }
      } catch (error) {
        console.error("Error inesperado al cargar datos:", error);
        setMensajeError("Ocurrió un error al cargar el formulario.");
      } finally {
        setCargando(false);
      }
    }

    void cargarDatos();
  }, [router]);

  useEffect(() => {
    function cerrarLista(event: MouseEvent) {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target as Node)
      ) {
        setListaUsuariosAbierta(false);
      }
    }

    document.addEventListener("mousedown", cerrarLista);
    return () => document.removeEventListener("mousedown", cerrarLista);
  }, []);

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

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const texto = busquedaUsuario.trim().toLowerCase();

    return (
      (usuario.full_name || "").toLowerCase().includes(texto) ||
      usuario.email.toLowerCase().includes(texto)
    );
  });

  function seleccionarUsuario(usuario: Perfil) {
    setReportadoSeleccionado(usuario.id);
    setBusquedaUsuario(
      `${usuario.full_name || "Sin nombre"} — ${usuario.email}`
    );
    setListaUsuariosAbierta(false);
  }

  function abrirSelector() {
    if (!puedeSeleccionarReportado) return;

    const seleccionado = usuarios.find(
      (usuario) => usuario.id === reportadoSeleccionado
    );

    setBusquedaUsuario(
      seleccionado
        ? `${seleccionado.full_name || "Sin nombre"} — ${seleccionado.email}`
        : ""
    );

    setListaUsuariosAbierta(true);
  }

  async function registrarRequerimiento(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setMensajeError("");

    if (!asunto.trim() || !descripcion.trim() || !categoria || !prioridad) {
      setMensajeError("Por favor, completa todos los campos.");
      return;
    }

    if (!perfil) {
      setMensajeError("No fue posible verificar tu perfil.");
      return;
    }

    if (!reportadoSeleccionado) {
      setMensajeError("Selecciona la persona que reporta el requerimiento.");
      return;
    }

    setGuardando(true);

    try {
      const { data: usuarioData, error: errorUsuario } =
        await supabase.auth.getUser();

      if (errorUsuario || !usuarioData.user) {
        setMensajeError("Tu sesión ha expirado. Inicia sesión nuevamente.");
        router.replace("/");
        return;
      }

      const usuarioId = usuarioData.user.id;

      const responsableInicial =
        perfil.role === "administrador" || perfil.role === "tecnico"
          ? usuarioId
          : null;

      const { error } = await supabase.from("casos").insert([
        {
          tipo: "requerimiento",
          asunto: asunto.trim(),
          descripcion: descripcion.trim(),
          categoria,
          prioridad,
          estado: "Pendiente",
          creado_por: usuarioId,
          reportado_por: reportadoSeleccionado,
          tecnico_id: responsableInicial,
        },
      ]);

      if (error) {
        console.error("Error al registrar requerimiento:", error);
        setMensajeError(
          `No fue posible registrar el requerimiento: ${error.message}`
        );
        return;
      }

      alert("¡Requerimiento registrado correctamente!");

      router.push("/requerimientos");
      router.refresh();
    } catch (error) {
      console.error("Error inesperado:", error);
      setMensajeError(
        "Ocurrió un error inesperado al registrar el requerimiento."
      );
    } finally {
      setGuardando(false);
    }
  }

  const encabezado = (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-[76px] items-center justify-between bg-[#192f50] px-5 text-white shadow-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-default rounded-lg px-3 py-2 text-xl"
          title="Menú"
          aria-label="Menú"
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
          className="rounded-lg border border-slate-500 px-3 py-2 text-xs font-medium transition hover:bg-white/10 sm:text-sm"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Verificando acceso...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {encabezado}

      <div className="min-h-screen px-4 pb-10 pt-[100px] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">

          {/* Encabezado de la página */}
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <span>Requerimientos</span>
                <span className="text-slate-300">/</span>
                <span className="font-medium text-blue-700">
                  Nuevo requerimiento
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Registrar nuevo requerimiento
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Registra la información del requerimiento para iniciar su
                seguimiento y gestión dentro de TracePYME.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full border border-orange-200 bg-orange-50 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>
              <span className="text-xs font-semibold text-orange-700">
                Nuevo registro
              </span>
            </div>
          </div>

          {/* Formulario */}
          <form
            onSubmit={registrarRequerimiento}
            className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* Título de la tarjeta */}
            <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
                  ⚠
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Información del requerimiento
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Los campos marcados con * son obligatorios.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-7 px-5 py-6 sm:px-8 sm:py-8">

              {/* Autor del registro */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-lg text-blue-700">
                    ♙
                  </div>

                  <div className="min-w-0 flex-1">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Autor del registro
                    </label>

                    <p className="text-sm font-semibold text-blue-900">
                      {perfil?.full_name || "Sin nombre registrado"}
                    </p>

                    <p className="mt-1 break-words text-xs text-slate-500">
                      {perfil?.email} · {perfil ? nombresRoles[perfil.role] : ""}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Este dato se registra automáticamente y no se puede
                      modificar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Reportado por */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Reportado por <span className="text-red-500">*</span>
                </label>

                {puedeSeleccionarReportado ? (
                  <div className="relative" ref={selectorRef}>
                    <div className="relative">
                      <input
                        type="text"
                        value={busquedaUsuario}
                        onFocus={() => {
                          if (!listaUsuariosAbierta) {
                            const seleccionado = usuarios.find(
                              (usuario) =>
                                usuario.id === reportadoSeleccionado
                            );

                            setBusquedaUsuario(
                              seleccionado
                                ? `${seleccionado.full_name || "Sin nombre"} — ${seleccionado.email}`
                                : ""
                            );
                          }
                          setListaUsuariosAbierta(true);
                        }}
                        onClick={() => setListaUsuariosAbierta(true)}
                        onChange={(e) => {
                          setBusquedaUsuario(e.target.value);
                          setReportadoSeleccionado("");
                          setListaUsuariosAbierta(true);
                        }}
                        placeholder="Buscar o seleccionar una persona..."
                        autoComplete="off"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pr-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (listaUsuariosAbierta) {
                            setListaUsuariosAbierta(false);
                          } else {
                            abrirSelector();
                          }
                        }}
                        className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 transition hover:text-blue-600"
                        aria-label="Mostrar usuarios"
                      >
                        <span className="text-lg">⌄</span>
                      </button>
                    </div>

                    {listaUsuariosAbierta && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                        {usuariosFiltrados.length > 0 ? (
                          usuariosFiltrados.map((usuario) => (
                            <button
                              key={usuario.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => seleccionarUsuario(usuario)}
                              className={`block w-full px-4 py-3 text-left transition hover:bg-blue-50 ${
                                reportadoSeleccionado === usuario.id
                                  ? "bg-blue-50"
                                  : ""
                              }`}
                            >
                              <span className="block text-sm font-semibold text-slate-700">
                                {usuario.full_name || "Sin nombre registrado"}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {usuario.email} · {nombresRoles[usuario.role]}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-slate-500">
                            No se encontraron usuarios.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-700">
                      {perfil?.full_name || "Usuario"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {perfil?.email}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      El requerimiento se registrará a tu nombre.
                    </p>
                  </div>
                )}

                <p className="mt-2 text-xs text-slate-400">
                  {puedeSeleccionarReportado
                    ? "Haz clic para desplegar la lista o escribe para buscar por nombre o correo."
                    : ""}
                </p>
              </div>

              {/* Asunto */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Asunto <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  maxLength={150}
                  placeholder="Ejemplo: Solicitud de instalación de un programa"
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Descripción del requerimiento{" "}
                  <span className="text-red-500">*</span>
                </label>

                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  required
                  placeholder="Describe qué necesitas, cuál es el objetivo y qué características debe tener el requerimiento..."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {descripcion.length}/2000 caracteres
                </p>
              </div>

              {/* Categoría y prioridad */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Categoría <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Seleccionar categoría</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Redes">Redes</option>
                    <option value="Accesos">Accesos</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Prioridad <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Seleccionar prioridad</option>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
              </div>

              {/* Responsable inicial */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Responsable inicial
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {puedeSeleccionarReportado ? (
                    <>
                      <p className="text-sm font-semibold text-slate-700">
                        {perfil?.full_name || "Administrador o técnico"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        El requerimiento quedará asignado automáticamente a
                        quien lo registra.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-500">
                        Sin asignar
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Un administrador o técnico podrá asignar un
                        responsable posteriormente.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Estado inicial */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Estado inicial
                </label>

                <div className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>
                  <span className="text-sm font-semibold text-orange-700">
                    Pendiente
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  El requerimiento se registrará automáticamente con estado
                  Pendiente.
                </p>
              </div>

              {/* Mensaje de error */}
              {mensajeError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <span className="text-lg">⚠</span>
                  <p>{mensajeError}</p>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-5 py-5 sm:flex-row sm:justify-end sm:px-8">
              <button
                type="button"
                onClick={() => router.push("/requerimientos")}
                disabled={guardando}
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardando ? "Registrando..." : "Registrar requerimiento"}
              </button>
            </div>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            TracePYME · Plataforma de trazabilidad para PYMES
          </p>
        </div>
      </div>
    </main>
  );
}

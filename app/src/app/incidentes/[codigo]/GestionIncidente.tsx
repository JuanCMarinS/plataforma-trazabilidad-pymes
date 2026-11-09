
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  email: string;
  full_name: string | null;
  role: "administrador" | "tecnico" | "usuario";
};

type Caso = {
  id: string;
  codigo: string;
  tipo: string;
  asunto: string;
  descripcion: string;
  categoria: string | null;
  prioridad: string;
  estado: string;
  reportado_por: string;
  tecnico_id: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string | null;
  solucion: string | null;
  resolucion_caso: string | null;
  fecha_resolucion: string | null;
  fecha_limite_resolucion: string | null;
  resuelto_por: string | null;
  fecha_solucion: string | null;
};

type Nota = {
  id: string;
  caso_id: string;
  usuario_id: string;
  nota: string;
  created_at: string;
  nombre_usuario?: string;
};

type Historial = {
  id: string;
  caso_id: string;
  usuario_id: string | null;
  resolucion: string;
  fecha_respuesta: string;
  origen: string;
  nombre_usuario?: string;
};

const nombresRoles = {
  administrador: "Administrador",
  tecnico: "Técnico",
  usuario: "Usuario",
};

export default function GestionIncidente({
  codigo,
}: {
  codigo: string;
}) {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [caso, setCaso] = useState<Caso | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);

  const [solucion, setSolucion] = useState("");
  const [nuevaNota, setNuevaNota] = useState("");
  const [motivoReapertura, setMotivoReapertura] = useState("");
  const [responsableSeleccionado, setResponsableSeleccionado] =
    useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [solicitandoReapertura, setSolicitandoReapertura] =
    useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const puedeGestionar =
    perfil?.role === "administrador" ||
    perfil?.role === "tecnico";

  const esUsuario = perfil?.role === "usuario";
  const esReportante = caso?.reportado_por === perfil?.id;

  const incidenteSolucionado = caso?.estado === "Solucionado";

  const solucionGuardada =
    !!caso?.solucion?.trim() &&
    solucion.trim() === (caso?.solucion?.trim() || "");

  const puedeResponderReapertura =
    !!(
      incidenteSolucionado &&
      esUsuario &&
      esReportante &&
      !caso?.resolucion_caso
    );

  const obtenerPerfil = (id: string | null | undefined) => {
    if (!id) return null;
    return perfiles.find((p) => p.id === id) || null;
  };

  const obtenerNombre = (id: string | null | undefined) => {
    const persona = obtenerPerfil(id);

    return (
      persona?.full_name?.trim() ||
      persona?.email ||
      "No disponible"
    );
  };

  function obtenerNombreDesdeLista(
    lista: Perfil[],
    id: string | null | undefined
  ) {
    if (!id) return "Sistema";

    const persona = lista.find((p) => p.id === id);

    return (
      persona?.full_name?.trim() ||
      persona?.email ||
      "Usuario"
    );
  }

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const {
        data: { user },
        error: errorUsuario,
      } = await supabase.auth.getUser();

      if (errorUsuario || !user) {
        router.push("/");
        return;
      }

      const { data: perfilActual, error: errorPerfil } =
        await supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .eq("id", user.id)
          .single();

      if (errorPerfil || !perfilActual) {
        throw new Error("No fue posible consultar el perfil.");
      }

      setPerfil(perfilActual as Perfil);

      const { data: casoEncontrado, error: errorCaso } =
        await supabase
          .from("casos")
          .select("*")
          .eq("codigo", codigo)
          .eq("tipo", "incidente")
          .maybeSingle();

      if (errorCaso) throw errorCaso;

      if (!casoEncontrado) {
        setCaso(null);
        return;
      }

      setCaso(casoEncontrado as Caso);
      setSolucion(casoEncontrado.solucion || "");
      setResponsableSeleccionado(
        casoEncontrado.tecnico_id || ""
      );

      const { data: listaPerfiles, error: errorPerfiles } =
        await supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .order("full_name", { ascending: true });

      if (errorPerfiles) throw errorPerfiles;

      const perfilesCargados = (listaPerfiles || []) as Perfil[];
      setPerfiles(perfilesCargados);

      const { data: listaNotas, error: errorNotas } =
        await supabase
          .from("notas_casos")
          .select("*")
          .eq("caso_id", casoEncontrado.id)
          .order("created_at", { ascending: true });

      if (errorNotas) throw errorNotas;

      setNotas(
        (listaNotas || []).map((nota: Nota) => ({
          ...nota,
          nombre_usuario: obtenerNombreDesdeLista(
            perfilesCargados,
            nota.usuario_id
          ),
        }))
      );

      const {
        data: listaHistorial,
        error: errorHistorial,
      } = await supabase
        .from("historial_resoluciones")
        .select("*")
        .eq("caso_id", casoEncontrado.id)
        .order("fecha_respuesta", { ascending: false });

      if (errorHistorial) throw errorHistorial;

      setHistorial(
        (listaHistorial || []).map((registro: Historial) => ({
          ...registro,
          nombre_usuario: obtenerNombreDesdeLista(
            perfilesCargados,
            registro.usuario_id
          ),
        }))
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar el incidente."
      );
    } finally {
      setCargando(false);
    }
  }, [codigo, router]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function guardarNota() {
    setMensaje("");
    setError("");

    if (!nuevaNota.trim()) {
      setError("Escribe una nota antes de guardarla.");
      return;
    }

    if (!caso || !perfil) return;

    if (incidenteSolucionado) {
      setError(
        "El incidente está solucionado. Las notas están bloqueadas."
      );
      return;
    }

    setGuardando(true);

    try {
      const { error: errorInsertar } = await supabase
        .from("notas_casos")
        .insert({
          caso_id: caso.id,
          usuario_id: perfil.id,
          nota: nuevaNota.trim(),
        });

      if (errorInsertar) throw errorInsertar;

      setNuevaNota("");
      setMensaje("La nota se registró correctamente.");
      await cargarDatos();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la nota."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function guardarSolucion() {
    setMensaje("");
    setError("");

    if (!caso || !puedeGestionar) return;

    if (incidenteSolucionado) {
      setError(
        "La solución está bloqueada porque el incidente ya fue solucionado."
      );
      return;
    }

    if (!solucion.trim()) {
      setError("Debes escribir la solución del incidente.");
      return;
    }

    setGuardando(true);

    try {
      const { data, error: errorActualizar } = await supabase
        .from("casos")
        .update({
          solucion: solucion.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", caso.id)
        .select("id, solucion")
        .single();

      if (errorActualizar) throw errorActualizar;

      setCaso((anterior) =>
        anterior
          ? { ...anterior, solucion: data.solucion }
          : anterior
      );

      setSolucion(data.solucion || "");
      setMensaje("La solución se guardó correctamente.");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la solución."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(nuevoEstado: string) {
    setMensaje("");
    setError("");

    if (!caso || !puedeGestionar) return;

    if (incidenteSolucionado) {
      setError(
        "El incidente ya está solucionado. La reapertura debe solicitarla el usuario reportante."
      );
      return;
    }

    // No permitir En proceso sin responsable asignado.
    if (nuevoEstado === "En proceso" && !caso.tecnico_id) {
      setError(
        "Primero debes asignar y guardar un responsable antes de cambiar el estado a En proceso."
      );
      return;
    }

    if (nuevoEstado === "Solucionado") {
      if (!caso.solucion?.trim()) {
        setError(
          "Primero debes guardar la solución del incidente."
        );
        return;
      }

      if (!solucionGuardada) {
        setError(
          "Guarda los cambios de la solución antes de marcar el incidente como solucionado."
        );
        return;
      }
    }

    setGuardando(true);

    try {
      const { error: errorActualizar } = await supabase
        .from("casos")
        .update({
          estado: nuevoEstado,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caso.id);

      if (errorActualizar) throw errorActualizar;

      setMensaje(`El estado cambió a ${nuevoEstado}.`);
      await cargarDatos();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible actualizar el estado."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarResponsable() {
    setMensaje("");
    setError("");

    if (!caso || !puedeGestionar) return;

    if (incidenteSolucionado) {
      setError(
        "No se puede modificar el responsable de un incidente solucionado."
      );
      return;
    }

    setGuardando(true);

    try {
      const { error: errorActualizar } = await supabase
        .from("casos")
        .update({
          tecnico_id: responsableSeleccionado || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caso.id);

      if (errorActualizar) throw errorActualizar;

      setMensaje("El responsable se actualizó correctamente.");
      await cargarDatos();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cambiar el responsable."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function enviarMotivoYReabrir() {
    setMensaje("");
    setError("");

    if (!caso || !perfil) return;

    if (!puedeResponderReapertura) {
      setError("No tienes permisos para solicitar la reapertura.");
      return;
    }

    if (!motivoReapertura.trim()) {
      setError(
        "Debes explicar por qué necesitas reabrir el incidente."
      );
      return;
    }

    if (
      !window.confirm(
        "¿Deseas enviar el motivo y reabrir este incidente?"
      )
    ) {
      return;
    }

    setGuardando(true);

    try {
      const { error: errorNota } = await supabase
        .from("notas_casos")
        .insert({
          caso_id: caso.id,
          usuario_id: perfil.id,
          nota: `MOTIVO DE REAPERTURA: ${motivoReapertura.trim()}`,
        });

      if (errorNota) throw errorNota;

      const { error: errorRpc } = await supabase.rpc(
        "responder_resolucion",
        {
          p_caso_id: caso.id,
          p_resolucion: "Reabrir caso",
        }
      );

      if (errorRpc) {
        throw new Error(
          "El motivo quedó guardado, pero no se pudo reabrir el caso: " +
            errorRpc.message
        );
      }

      setMotivoReapertura("");
      setSolicitandoReapertura(false);
      setMensaje(
        "El motivo quedó registrado y el incidente fue reabierto."
      );

      await cargarDatos();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible completar la reapertura."
      );
      await cargarDatos();
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarSatisfaccion() {
    setMensaje("");
    setError("");

    if (!caso || !esUsuario || !esReportante) return;

    if (
      !window.confirm(
        "¿Confirmas que estás satisfecho con la solución?"
      )
    ) {
      return;
    }

    setGuardando(true);

    try {
      const { error: errorRpc } = await supabase.rpc(
        "responder_resolucion",
        {
          p_caso_id: caso.id,
          p_resolucion: "Satisfecho",
        }
      );

      if (errorRpc) throw errorRpc;

      setMensaje("Tu conformidad quedó registrada.");
      await cargarDatos();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar tu respuesta."
      );
    } finally {
      setGuardando(false);
    }
  }

  function formatoFecha(fecha: string | null | undefined) {
    if (!fecha) return "No disponible";

    return new Date(fecha).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function colorEstado(estado: string) {
    switch (estado) {
      case "Pendiente":
        return "bg-orange-100 text-orange-700";
      case "En proceso":
        return "bg-blue-100 text-blue-700";
      case "Solucionado":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function colorPrioridad(prioridad: string) {
    switch (prioridad) {
      case "Baja":
        return "bg-green-100 text-green-700";
      case "Media":
        return "bg-yellow-100 text-yellow-700";
      case "Alta":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  const iniciales = perfil?.full_name
    ? perfil.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join("")
    : "US";

  const encabezado = (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-[76px] items-center justify-between bg-[#192f50] px-5 text-white shadow-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-xl cursor-default"
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
  );

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100">
        {encabezado}

        <div className="flex min-h-screen items-center justify-center pt-[76px]">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-900 border-t-transparent" />
            <p className="text-gray-600">Cargando incidente...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!caso) {
    return (
      <div className="min-h-screen bg-slate-100">
        {encabezado}

        <div className="flex justify-center p-6 pt-32">
          <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow">
            <h2 className="mb-3 text-xl font-bold text-gray-800">
              Incidente no encontrado
            </h2>

            <p className="mb-6 text-gray-600">
              No fue posible encontrar el incidente {codigo}.
            </p>

            <Link
              href="/incidentes"
              className="rounded-lg bg-blue-900 px-5 py-3 text-white hover:bg-blue-800"
            >
              Volver a incidentes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {encabezado}

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-[100px] sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-2 text-sm text-gray-500">
              <Link
                href="/incidentes"
                className="text-blue-800 hover:underline"
              >
                Incidentes
              </Link>
              <span className="mx-2">/</span>
              <span>Gestión del incidente</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-800">
              Gestión del incidente
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Consulta y administra la información del caso.
            </p>
          </div>

          <Link
            href="/incidentes"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Volver a incidentes
          </Link>
        </div>

        {mensaje && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* INFORMACIÓN GENERAL */}
        <section className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#192f50] px-5 py-4 text-white">
            <div>
              <p className="text-sm text-blue-200">
                Código del incidente
              </p>
              <h2 className="text-xl font-bold">
                {caso.codigo}
              </h2>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold ${colorEstado(
                caso.estado
              )}`}
            >
              {caso.estado}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Asunto
              </p>
              <p className="mt-1 font-medium text-gray-800">
                {caso.asunto}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Categoría
              </p>
              <p className="mt-1 text-gray-800">
                {caso.categoria || "No especificada"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Reportado por
              </p>
              <p className="mt-1 font-medium text-gray-800">
                {obtenerNombre(caso.reportado_por)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Responsable
              </p>
              <p className="mt-1 font-medium text-gray-800">
                {caso.tecnico_id
                  ? obtenerNombre(caso.tecnico_id)
                  : "Sin asignar"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Prioridad
              </p>
              <span
                className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${colorPrioridad(
                  caso.prioridad
                )}`}
              >
                {caso.prioridad}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Fecha de creación
              </p>
              <p className="mt-1 text-gray-800">
                {formatoFecha(caso.created_at)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Última actualización
              </p>
              <p className="mt-1 text-gray-800">
                {formatoFecha(caso.updated_at)}
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase text-gray-500">
                Descripción del incidente
              </p>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-gray-700">
                {caso.descripcion}
              </p>
            </div>
          </div>
        </section>

        {/* ADMINISTRACIÓN */}
        {puedeGestionar && (
          <section className="mb-6 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-b pb-3 text-lg font-bold text-gray-800">
              Administración del incidente
            </h2>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Responsable del incidente
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={responsableSeleccionado}
                  onChange={(e) =>
                    setResponsableSeleccionado(e.target.value)
                  }
                  disabled={guardando || !!incidenteSolucionado}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800 outline-none focus:border-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <option value="">Sin asignar</option>

                  {perfiles
                    .filter(
                      (p) =>
                        p.role === "administrador" ||
                        p.role === "tecnico"
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.email} (
                        {p.role === "administrador"
                          ? "Administrador"
                          : "Técnico"}
                        )
                      </option>
                    ))}
                </select>

                <button
                  onClick={cambiarResponsable}
                  disabled={guardando || !!incidenteSolucionado}
                  className="rounded-lg bg-[#192f50] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar responsable
                </button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">
                Cambiar estado del incidente
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => cambiarEstado("Pendiente")}
                  disabled={
                    guardando ||
                    caso.estado === "Pendiente" ||
                    !!incidenteSolucionado
                  }
                  className="rounded-lg bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pendiente
                </button>

                <button
                  onClick={() => cambiarEstado("En proceso")}
                  disabled={
                    guardando ||
                    caso.estado === "En proceso" ||
                    !!incidenteSolucionado ||
                    !caso.tecnico_id
                  }
                  title={
                    !caso.tecnico_id
                      ? "Debes escoger y guardar un responsable."
                      : ""
                  }
                  className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  En proceso
                </button>

                <button
                  onClick={() => cambiarEstado("Solucionado")}
                  disabled={
                    guardando ||
                    caso.estado === "Solucionado" ||
                    !caso.solucion?.trim() ||
                    !solucionGuardada
                  }
                  title={
                    !caso.solucion?.trim()
                      ? "Debes completar el campo de solución."
                      : !solucionGuardada
                      ? "Debes guardar la solución antes de continuar."
                      : ""
                  }
                  className="rounded-lg bg-green-100 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Marcar como solucionado
                </button>
              </div>

              {incidenteSolucionado && (
                <p className="mt-3 text-xs text-gray-500">
                  El incidente está solucionado. La reapertura debe
                  solicitarla el usuario que reportó el caso.
                </p>
              )}
            </div>
          </section>
        )}

        {/* NOTAS Y SEGUIMIENTO */}
        <section className="mb-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 border-b pb-3 text-lg font-bold text-gray-800">
            Notas y seguimiento
          </h2>

          {incidenteSolucionado ? (
            <div className="mb-5">
              <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-semibold text-orange-800">
                  Este incidente ya está solucionado.
                </p>
                <p className="mt-1 text-sm text-orange-700">
                  Las notas están bloqueadas. Si el problema continúa,
                  puedes solicitar la reapertura escribiendo el motivo.
                </p>
              </div>

              {puedeResponderReapertura && (
                <div className="rounded-lg border border-gray-200 p-4">
                  {!solicitandoReapertura ? (
                    <button
                      onClick={() => {
                        setSolicitandoReapertura(true);
                        setError("");
                        setMensaje("");
                      }}
                      className="rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
                    >
                      Solicitar reapertura
                    </button>
                  ) : (
                    <>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Motivo de la reapertura
                      </label>

                      <textarea
                        value={motivoReapertura}
                        onChange={(e) =>
                          setMotivoReapertura(e.target.value)
                        }
                        rows={4}
                        placeholder="Explica qué problema continúa o por qué la solución no fue suficiente..."
                        className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-800 outline-none focus:border-orange-500"
                      />

                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          onClick={enviarMotivoYReabrir}
                          disabled={
                            guardando || !motivoReapertura.trim()
                          }
                          className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {guardando
                            ? "Procesando..."
                            : "Enviar motivo y reabrir"}
                        </button>

                        <button
                          onClick={() => {
                            setSolicitandoReapertura(false);
                            setMotivoReapertura("");
                            setError("");
                          }}
                          disabled={guardando}
                          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Registrar una nota
              </label>

              <textarea
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                rows={3}
                placeholder="Escribe aquí una observación o actualización del incidente..."
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-800 outline-none focus:border-blue-700"
              />

              <div className="mt-3 flex justify-end">
                <button
                  onClick={guardarNota}
                  disabled={guardando || !nuevaNota.trim()}
                  className="rounded-lg bg-[#192f50] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar nota
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {notas.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                Todavía no hay notas registradas.
              </p>
            ) : (
              notas.map((nota) => (
                <div
                  key={nota.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-2 flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {nota.nombre_usuario}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatoFecha(nota.created_at)}
                    </p>
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    {nota.nota}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* SOLUCIÓN */}
        <section className="mb-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 border-b pb-3 text-lg font-bold text-gray-800">
            Solución del incidente
          </h2>

          {puedeGestionar ? (
            <>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Descripción de la solución aplicada
              </label>

              <textarea
                value={solucion}
                onChange={(e) => setSolucion(e.target.value)}
                rows={5}
                disabled={!!incidenteSolucionado}
                placeholder="Describe las actividades realizadas para solucionar el incidente..."
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-800 outline-none focus:border-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  {incidenteSolucionado
                    ? "La solución está bloqueada."
                    : solucionGuardada
                    ? "La solución está guardada."
                    : "Hay cambios pendientes por guardar."}
                </p>

                <button
                  onClick={guardarSolucion}
                  disabled={
                    guardando ||
                    !!incidenteSolucionado ||
                    !solucion.trim() ||
                    solucionGuardada
                  }
                  className="rounded-lg bg-[#192f50] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar solución
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-sm font-semibold text-gray-700">
                Solución registrada
              </p>

              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {caso.solucion ||
                  "Todavía no se ha registrado una solución."}
              </p>
            </div>
          )}
        </section>

        {/* CONFIRMACIÓN DE SOLUCIÓN */}
        {esUsuario &&
          esReportante &&
          incidenteSolucionado && (
            <section className="mb-6 rounded-xl border border-green-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-gray-800">
                Confirmación de la solución
              </h2>

              <p className="mb-4 text-sm text-gray-600">
                Puedes confirmar si estás satisfecho con la solución.
                Si el problema continúa, solicita la reapertura en
                Notas y seguimiento.
              </p>

              {caso.fecha_limite_resolucion && (
                <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  Fecha límite para responder:{" "}
                  <strong>
                    {formatoFecha(caso.fecha_limite_resolucion)}
                  </strong>
                </p>
              )}

              {caso.resolucion_caso ? (
                <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  Respuesta registrada:{" "}
                  <strong>{caso.resolucion_caso}</strong>
                  {caso.fecha_resolucion && (
                    <>
                      {" "}
                      el {formatoFecha(caso.fecha_resolucion)}
                    </>
                  )}
                </p>
              ) : (
                <button
                  onClick={confirmarSatisfaccion}
                  disabled={guardando}
                  className="rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Estoy satisfecho con la solución
                </button>
              )}
            </section>
          )}

        {/* HISTORIAL */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 border-b pb-3 text-lg font-bold text-gray-800">
            Historial de respuestas
          </h2>

          {historial.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
              No hay respuestas registradas en el historial.
            </p>
          ) : (
            <div className="space-y-3">
              {historial.map((registro) => (
                <div
                  key={registro.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="mb-2 flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {registro.nombre_usuario}
                    </p>

                    <p className="text-xs text-gray-500">
                      {formatoFecha(registro.fecha_respuesta)}
                    </p>
                  </div>

                  <p className="text-sm text-gray-700">
                    {registro.resolucion === "Satisfecho"
                      ? "El usuario confirmó que está satisfecho con la solución."
                      : registro.resolucion === "Reabrir caso"
                      ? "El usuario solicitó reabrir el incidente."
                      : registro.resolucion}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

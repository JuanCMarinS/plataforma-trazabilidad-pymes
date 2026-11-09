
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Rol = "administrador" | "tecnico" | "usuario";

type Perfil = {
  id: string;
  email: string;
  full_name: string | null;
  role: Rol;
};

type Usuario = {
  id: string;
  email: string;
  full_name: string | null;
  role: Rol;
};

const opcionesMenu = [
  { nombre: "Resumen", ruta: "/resumen", icono: "▦" },
  { nombre: "Incidentes", ruta: "/incidentes", icono: "⚠" },
  { nombre: "Requerimientos", ruta: "/requerimientos", icono: "▤" },
  { nombre: "Analítica", ruta: "/analitica", icono: "▥" },
  { nombre: "Reportes", ruta: "/reportes", icono: "▧" },
  { nombre: "Usuarios", ruta: "/usuarios", icono: "♙" },
];

const nombresRoles: Record<Rol, string> = {
  administrador: "Administrador",
  tecnico: "Técnico",
  usuario: "Usuario",
};

export default function UsuariosPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [cargando, setCargando] = useState(true);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [menuAbierto, setMenuAbierto] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);

  // Estados para crear usuarios
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Rol>("usuario");

  // Estados para restablecer contraseñas
  const [modalRestablecerAbierto, setModalRestablecerAbierto] =
    useState(false);
  const [usuarioRestablecer, setUsuarioRestablecer] =
    useState<Usuario | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Ocultar automáticamente los mensajes después de 3 segundos
  useEffect(() => {
    if (!mensaje) return;

    const temporizador = setTimeout(() => {
      setMensaje("");
    }, 3000);

    return () => clearTimeout(temporizador);
  }, [mensaje]);

  const autorizado = perfil?.role === "administrador";

  const iniciales = perfil?.full_name
    ? perfil.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join("")
    : "US";

  const obtenerToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }, []);

  const leerRespuesta = async (respuesta: Response) => {
    const texto = await respuesta.text();

    if (!texto) {
      return {};
    }

    try {
      return JSON.parse(texto);
    } catch {
      throw new Error("El servidor devolvió una respuesta no válida.");
    }
  };

  const cargarUsuarios = useCallback(async () => {
    setCargandoUsuarios(true);
    setError("");

    try {
      const token = await obtenerToken();

      if (!token) {
        router.replace("/");
        return;
      }

      const respuesta = await fetch("/api/usuarios", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const resultado = await leerRespuesta(respuesta);

      if (!respuesta.ok) {
        throw new Error(
          resultado.error || "No fue posible cargar los usuarios."
        );
      }

      setUsuarios(resultado.usuarios || resultado.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cargar los usuarios."
      );
    } finally {
      setCargandoUsuarios(false);
    }
  }, [obtenerToken, router]);

  useEffect(() => {
    const verificarAcceso = async () => {
      try {
        const {
          data: { user },
          error: errorUsuario,
        } = await supabase.auth.getUser();

        if (errorUsuario || !user) {
          router.replace("/");
          return;
        }

        const { data: perfilActual, error: errorPerfil } = await supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .eq("id", user.id)
          .single();

        if (errorPerfil || !perfilActual) {
          router.replace("/");
          return;
        }

        setPerfil(perfilActual as Perfil);

        if (perfilActual.role === "administrador") {
          await cargarUsuarios();
        }
      } catch {
        router.replace("/");
      } finally {
        setCargando(false);
      }
    };

    verificarAcceso();
  }, [router, cargarUsuarios]);

  // CREAR USUARIO
  const crearUsuario = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setMensaje("");

    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setError("Completa todos los campos.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }

    setGuardando(true);

    try {
      const token = await obtenerToken();

      if (!token) {
        router.replace("/");
        return;
      }

      const respuesta = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        }),
      });

      const resultado = await leerRespuesta(respuesta);

      if (!respuesta.ok) {
        throw new Error(
          resultado.error || "No fue posible crear el usuario."
        );
      }

      setMensaje("El usuario fue creado correctamente.");

      setNombre("");
      setEmail("");
      setPassword("");
      setRole("usuario");
      setModalAbierto(false);

      await cargarUsuarios();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al crear el usuario."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ABRIR MODAL PARA RESTABLECER CONTRASEÑA
  const abrirModalRestablecer = (usuario: Usuario) => {
    setUsuarioRestablecer(usuario);
    setNuevaPassword("");
    setConfirmarPassword("");
    setError("");
    setMensaje("");
    setModalRestablecerAbierto(true);
  };

  // RESTABLECER CONTRASEÑA
  const restablecerPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setMensaje("");

    if (!usuarioRestablecer) {
      setError("No se ha seleccionado un usuario.");
      return;
    }

    if (!nuevaPassword || !confirmarPassword) {
      setError("Completa los dos campos de contraseña.");
      return;
    }

    if (nuevaPassword.length < 6) {
      setError("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);

    try {
      const token = await obtenerToken();

      if (!token) {
        router.replace("/");
        return;
      }

      const respuesta = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: usuarioRestablecer.id,
          password: nuevaPassword,
        }),
      });

      const resultado = await leerRespuesta(respuesta);

      if (!respuesta.ok) {
        throw new Error(
          resultado.error || "No fue posible restablecer la contraseña."
        );
      }

      setMensaje(
        `La contraseña de ${usuarioRestablecer.full_name || usuarioRestablecer.email} fue actualizada correctamente.`
      );

      setModalRestablecerAbierto(false);
      setUsuarioRestablecer(null);
      setNuevaPassword("");
      setConfirmarPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al restablecer la contraseña."
      );
    } finally {
      setGuardando(false);
    }
  };

  // CERRAR MODAL DE RESTABLECIMIENTO
  const cerrarModalRestablecer = () => {
    if (guardando) return;

    setModalRestablecerAbierto(false);
    setUsuarioRestablecer(null);
    setNuevaPassword("");
    setConfirmarPassword("");
    setError("");
  };

  // ELIMINAR USUARIO
  const eliminarUsuario = async (usuario: Usuario) => {
    const confirmar = window.confirm(
      `¿Estás seguro de eliminar al usuario ${usuario.full_name || usuario.email}?`
    );

    if (!confirmar) return;

    setError("");
    setMensaje("");

    try {
      const token = await obtenerToken();

      if (!token) {
        router.replace("/");
        return;
      }

      const respuesta = await fetch("/api/usuarios", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: usuario.id,
        }),
      });

      const resultado = await leerRespuesta(respuesta);

      if (!respuesta.ok) {
        throw new Error(
          resultado.error || "No fue posible eliminar el usuario."
        );
      }

      setMensaje("El usuario fue eliminado correctamente.");

      await cargarUsuarios();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al eliminar el usuario."
      );
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Verificando acceso...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* ENCABEZADO PRINCIPAL */}
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
        {/* MENÚ LATERAL */}
        {menuAbierto && (
          <aside className="fixed bottom-0 left-0 top-[76px] z-20 flex w-56 flex-col border-r border-slate-200 bg-slate-50">
            <nav className="flex-1 space-y-1 px-3 py-4">
              {opcionesMenu.map((opcion) => (
                <button
                  key={opcion.nombre}
                  onClick={() => router.push(opcion.ruta)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                    opcion.nombre === "Usuarios"
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
            {!autorizado ? (
              /* MENSAJE DE ACCESO NO AUTORIZADO */
              <div className="flex min-h-[65vh] items-center justify-center">
                <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
                    !
                  </div>

                  <h2 className="mt-5 text-xl font-bold text-slate-800">
                    Acceso no autorizado
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    No tienes permisos para consultar la página de Usuarios.
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
            ) : (
              /* GESTIÓN DE USUARIOS */
              <div>
                <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      Gestión de usuarios
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Administra las cuentas y los permisos de acceso a
                      TracePYME.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setError("");
                      setMensaje("");
                      setModalAbierto(true);
                    }}
                    className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    + Crear usuario
                  </button>
                </div>

                {mensaje && (
                  <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {mensaje}
                  </div>
                )}

                {error && !modalAbierto && !modalRestablecerAbierto && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* INDICADORES DE USUARIOS */}
                <div className="mb-5 grid grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                      Total de usuarios
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-800">
                      {usuarios.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                      Administradores
                    </p>
                    <p className="mt-2 text-3xl font-bold text-blue-700">
                      {
                        usuarios.filter(
                          (usuario) => usuario.role === "administrador"
                        ).length
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Técnicos</p>
                    <p className="mt-2 text-3xl font-bold text-purple-700">
                      {
                        usuarios.filter(
                          (usuario) => usuario.role === "tecnico"
                        ).length
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Usuarios</p>
                    <p className="mt-2 text-3xl font-bold text-green-700">
                      {
                        usuarios.filter(
                          (usuario) => usuario.role === "usuario"
                        ).length
                      }
                    </p>
                  </div>
                </div>

                {/* TABLA DE USUARIOS */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        Usuarios registrados
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Cuentas creadas en la plataforma.
                      </p>
                    </div>

                    <button
                      onClick={cargarUsuarios}
                      disabled={cargandoUsuarios}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {cargandoUsuarios ? "Actualizando..." : "Actualizar"}
                    </button>
                  </div>

                  {cargandoUsuarios ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      Cargando usuarios...
                    </div>
                  ) : usuarios.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      No hay usuarios registrados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-5 py-4 font-semibold">
                              Nombre
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Correo electrónico
                            </th>

                            <th className="px-5 py-4 font-semibold">Rol</th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Acciones
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {usuarios.map((usuario) => (
                            <tr
                              key={usuario.id}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="px-5 py-4 font-medium text-slate-800">
                                {usuario.full_name || "Sin nombre"}
                              </td>

                              <td className="px-5 py-4 text-slate-600">
                                {usuario.email}
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                    usuario.role === "administrador"
                                      ? "bg-blue-100 text-blue-700"
                                      : usuario.role === "tecnico"
                                        ? "bg-purple-100 text-purple-700"
                                        : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {nombresRoles[usuario.role]}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() =>
                                      abrirModalRestablecer(usuario)
                                    }
                                    className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                                  >
                                    Restablecer contraseña
                                  </button>

                                  {usuario.id === perfil?.id ? (
                                    <span className="whitespace-nowrap text-xs text-slate-400">
                                      Cuenta actual
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        eliminarUsuario(usuario)
                                      }
                                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* MODAL CREAR USUARIO */}
                {modalAbierto && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">
                            Crear usuario
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Registra una nueva cuenta en TracePYME.
                          </p>
                        </div>

                        <button
                          onClick={() => setModalAbierto(false)}
                          className="rounded-lg px-3 py-2 text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Cerrar ventana"
                        >
                          ×
                        </button>
                      </div>

                      <form onSubmit={crearUsuario} className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Nombre completo
                          </label>

                          <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ingresa el nombre completo"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Correo electrónico
                          </label>

                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ejemplo@correo.com"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Contraseña
                          </label>

                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Rol del usuario
                          </label>

                          <select
                            value={role}
                            onChange={(e) =>
                              setRole(e.target.value as Rol)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="usuario">Usuario</option>
                            <option value="tecnico">Técnico</option>
                            <option value="administrador">
                              Administrador
                            </option>
                          </select>
                        </div>

                        {error && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                          </div>
                        )}

                        <div className="flex justify-end gap-3 pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setModalAbierto(false);
                              setError("");
                            }}
                            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Cancelar
                          </button>

                          <button
                            type="submit"
                            disabled={guardando}
                            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {guardando ? "Creando..." : "Crear usuario"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* MODAL RESTABLECER CONTRASEÑA */}
                {modalRestablecerAbierto && usuarioRestablecer && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">
                            Restablecer contraseña
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Cambia la contraseña de esta cuenta.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={cerrarModalRestablecer}
                          disabled={guardando}
                          className="rounded-lg px-3 py-2 text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                          aria-label="Cerrar ventana"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase text-slate-500">
                          Cuenta seleccionada
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          {usuarioRestablecer.full_name || "Sin nombre"}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {usuarioRestablecer.email}
                        </p>
                      </div>

                      <form
                        onSubmit={restablecerPassword}
                        className="space-y-4"
                      >
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Nueva contraseña
                          </label>

                          <input
                            type="password"
                            value={nuevaPassword}
                            onChange={(e) =>
                              setNuevaPassword(e.target.value)
                            }
                            placeholder="Mínimo 6 caracteres"
                            autoComplete="new-password"
                            disabled={guardando}
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Confirmar nueva contraseña
                          </label>

                          <input
                            type="password"
                            value={confirmarPassword}
                            onChange={(e) =>
                              setConfirmarPassword(e.target.value)
                            }
                            placeholder="Escribe nuevamente la contraseña"
                            autoComplete="new-password"
                            disabled={guardando}
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                          />
                        </div>

                        <p className="text-xs leading-5 text-slate-500">
                          La nueva contraseña reemplazará la anterior. El
                          usuario deberá utilizarla en su próximo inicio de
                          sesión.
                        </p>

                        {error && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                          </div>
                        )}

                        <div className="flex justify-end gap-3 pt-3">
                          <button
                            type="button"
                            onClick={cerrarModalRestablecer}
                            disabled={guardando}
                            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>

                          <button
                            type="submit"
                            disabled={guardando}
                            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {guardando
                              ? "Actualizando..."
                              : "Guardar contraseña"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

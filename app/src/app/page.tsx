
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMensaje("");
    setCargando(true);

    try {
      // Verificar las credenciales en Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo.trim().toLowerCase(),
        password: contrasena,
      });

      // Mostrar el error real si Supabase rechaza el acceso
      if (error) {
        console.error("Error de Supabase al iniciar sesión:", error);

        setMensaje("Error de inicio de sesión: " + error.message);
        return;
      }

      // Consultar el perfil y el rol del usuario
      const { data: perfil, error: errorPerfil } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      // Si no existe el perfil, cerrar la sesión
      if (errorPerfil || !perfil) {
        console.error("Error al consultar el perfil:", errorPerfil);

        await supabase.auth.signOut();

        setMensaje(
          "No se encontró el perfil de este usuario. Contacta al administrador."
        );
        return;
      }

      // Acceso correcto: dirigir al resumen
      router.push("/resumen");
    } catch (error) {
      console.error("Error inesperado:", error);

      setMensaje(
        error instanceof Error
          ? error.message
          : "No fue posible conectar con el servicio. Intenta nuevamente."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-2">

        {/* Panel de presentación */}
        <section className="flex flex-col justify-between bg-slate-900 p-8 text-white sm:p-12">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 text-2xl font-bold">
                T
              </div>

              <div>
                <p className="text-lg font-bold">TracePYME</p>
                <p className="text-xs text-slate-300">
                  Gestión y trazabilidad
                </p>
              </div>
            </div>

            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-300">
              Plataforma de servicios TI
            </p>

            <h1 className="mb-5 text-3xl font-bold leading-tight sm:text-4xl">
              Todo bajo control.
              <br />
              Cada proceso trazable.
            </h1>

            <p className="max-w-md leading-7 text-slate-300">
              Centraliza incidentes y solicitudes, consulta su historial y
              conoce el estado de cada proceso desde un solo lugar.
            </p>
          </div>

          <div className="mt-12 border-t border-slate-700 pt-5 text-sm text-slate-400">
            Plataforma de trazabilidad para pequeñas y medianas empresas.
          </div>
        </section>

        {/* Formulario de inicio de sesión */}
        <section className="flex items-center justify-center p-7 sm:p-12">
          <div className="w-full max-w-sm">

            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-blue-600">
                BIENVENIDO
              </p>

              <h2 className="text-3xl font-bold text-slate-900">
                Iniciar sesión
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Ingresa tus datos para acceder a la plataforma.
              </p>
            </div>

            <form onSubmit={iniciarSesion} className="space-y-5">

              {/* Correo electrónico */}
              <div>
                <label
                  htmlFor="correo"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Correo electrónico
                </label>

                <input
                  id="correo"
                  type="email"
                  autoComplete="username"
                  placeholder="usuario@empresa.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              {/* Contraseña */}
              <div>
                <label
                  htmlFor="contrasena"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Contraseña
                </label>

                <div className="relative">
                  <input
                    id="contrasena"
                    type={mostrarContrasena ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingresa tu contraseña"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-20 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarContrasena(!mostrarContrasena)
                    }
                    className="absolute inset-y-0 right-3 text-sm font-medium text-blue-600"
                  >
                    {mostrarContrasena ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {/* Mensajes de error */}
              {mensaje && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700"
                >
                  {mensaje}
                </div>
              )}

              {/* Botón de ingreso */}
              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando
                  ? "Verificando..."
                  : "Ingresar a la plataforma"}
              </button>

            </form>

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">
              Acceso para usuarios autorizados de la organización.
            </p>

          </div>
        </section>
      </div>
    </main>
  );
}

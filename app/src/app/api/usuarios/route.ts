
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ResultadoAutorizacion =
  | { userId: string }
  | { error: string; status: number };

function respuestaError(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status });
}

function obtenerClienteAdmin() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Falta configurar SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL en .env.local."
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verificarAdministrador(
  request: NextRequest
): Promise<ResultadoAutorizacion> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: "No has iniciado sesión.",
      status: 401,
    };
  }

  if (!supabaseUrl || !anonKey) {
    return {
      error: "Falta configurar la conexión de Supabase.",
      status: 500,
    };
  }

  const token = authorization.substring(7);

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: "La sesión no es válida.",
      status: 401,
    };
  }

  try {
    const admin = obtenerClienteAdmin();

    const { data: perfil, error: perfilError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (perfilError) {
      return {
        error: "No fue posible verificar tu perfil.",
        status: 500,
      };
    }

    if (perfil?.role !== "administrador") {
      return {
        error: "No tienes permisos para realizar esta operación.",
        status: 403,
      };
    }

    return {
      userId: data.user.id,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Error al conectar con Supabase.",
      status: 500,
    };
  }
}

// ==========================================
// CONSULTAR USUARIOS
// ==========================================

export async function GET(request: NextRequest) {
  const autorizacion = await verificarAdministrador(request);

  if ("error" in autorizacion) {
    return respuestaError(autorizacion.error, autorizacion.status);
  }

  try {
    const admin = obtenerClienteAdmin();

    const { data: authData, error: authError } =
      await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) {
      return respuestaError(authError.message, 400);
    }

    const ids = authData.users.map((usuario) => usuario.id);

    if (ids.length === 0) {
      return NextResponse.json({ usuarios: [] });
    }

    const { data: perfiles, error: perfilesError } = await admin
      .from("profiles")
      .select("id, email, full_name, role")
      .in("id", ids);

    if (perfilesError) {
      return respuestaError(
        "No fue posible consultar los perfiles: " + perfilesError.message,
        500
      );
    }

    const usuarios = authData.users.map((usuario) => {
      const perfil = perfiles?.find((p) => p.id === usuario.id);

      const rolValido = [
        "administrador",
        "tecnico",
        "usuario",
      ].includes(perfil?.role ?? "");

      return {
        id: usuario.id,
        email: perfil?.email || usuario.email || "",
        full_name:
          perfil?.full_name ||
          usuario.user_metadata?.full_name ||
          "Sin nombre",
        role: rolValido ? perfil!.role : "usuario",
      };
    });

    return NextResponse.json({ usuarios });
  } catch (error) {
    return respuestaError(
      error instanceof Error
        ? error.message
        : "Ocurrió un error al consultar los usuarios.",
      500
    );
  }
}

// ==========================================
// CREAR USUARIO
// ==========================================

export async function POST(request: NextRequest) {
  const autorizacion = await verificarAdministrador(request);

  if ("error" in autorizacion) {
    return respuestaError(autorizacion.error, autorizacion.status);
  }

  try {
    const admin = obtenerClienteAdmin();
    const body = await request.json();

    const nombre = String(body.nombre ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "");

    if (!nombre || !email || !password || !role) {
      return respuestaError("Todos los campos son obligatorios.", 400);
    }

    if (password.length < 6) {
      return respuestaError(
        "La contraseña debe tener al menos 6 caracteres.",
        400
      );
    }

    if (!["administrador", "tecnico", "usuario"].includes(role)) {
      return respuestaError("El perfil seleccionado no es válido.", 400);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: nombre,
      },
    });

    if (error || !data.user) {
      return respuestaError(
        error?.message || "No fue posible crear la cuenta.",
        400
      );
    }

    const { error: perfilError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        email,
        full_name: nombre,
        role,
      },
      {
        onConflict: "id",
      }
    );

    if (perfilError) {
      await admin.auth.admin.deleteUser(data.user.id);

      return respuestaError(
        "No fue posible guardar el perfil: " + perfilError.message,
        500
      );
    }

    return NextResponse.json({
      mensaje: "Usuario creado correctamente.",
    });
  } catch (error) {
    return respuestaError(
      error instanceof Error
        ? error.message
        : "Error al crear el usuario.",
      500
    );
  }
}

// ==========================================
// ELIMINAR USUARIO
// ==========================================

export async function DELETE(request: NextRequest) {
  const autorizacion = await verificarAdministrador(request);

  if ("error" in autorizacion) {
    return respuestaError(autorizacion.error, autorizacion.status);
  }

  try {
    const admin = obtenerClienteAdmin();
    const body = await request.json();

    const usuarioId = String(body.id ?? "");

    if (!usuarioId) {
      return respuestaError(
        "No se indicó el usuario que deseas eliminar.",
        400
      );
    }

    if (usuarioId === autorizacion.userId) {
      return respuestaError(
        "No puedes eliminar tu propia cuenta mientras tienes la sesión iniciada.",
        400
      );
    }

    const { error } = await admin.auth.admin.deleteUser(usuarioId);

    if (error) {
      return respuestaError(error.message, 400);
    }

    return NextResponse.json({
      mensaje: "Usuario eliminado correctamente.",
    });
  } catch (error) {
    return respuestaError(
      error instanceof Error
        ? error.message
        : "Error al eliminar el usuario.",
      500
    );
  }
}

// ==========================================
// RESTABLECER CONTRASEÑA
// ==========================================

export async function PATCH(request: NextRequest) {
  const autorizacion = await verificarAdministrador(request);

  if ("error" in autorizacion) {
    return respuestaError(autorizacion.error, autorizacion.status);
  }

  try {
    const admin = obtenerClienteAdmin();
    const body = await request.json();

    const usuarioId = String(body.id ?? "");
    const nuevaPassword = String(body.password ?? "");

    if (!usuarioId || !nuevaPassword) {
      return respuestaError(
        "Debes indicar el usuario y la nueva contraseña.",
        400
      );
    }

    if (nuevaPassword.length < 6) {
      return respuestaError(
        "La contraseña debe tener al menos 6 caracteres.",
        400
      );
    }

    const { error } = await admin.auth.admin.updateUserById(
      usuarioId,
      {
        password: nuevaPassword,
      }
    );

    if (error) {
      return respuestaError(
        "No fue posible restablecer la contraseña: " + error.message,
        400
      );
    }

    return NextResponse.json({
      mensaje: "Contraseña restablecida correctamente.",
    });
  } catch (error) {
    return respuestaError(
      error instanceof Error
        ? error.message
        : "Error al restablecer la contraseña.",
      500
    );
  }
}

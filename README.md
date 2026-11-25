# Sistema Dental — Renovando Sonrisas

Sistema web de gestión para el consultorio dental Renovando Sonrisas: portal público para pacientes y panel privado para el dentista.

**Estado:** base técnica terminada (monorepo, base de datos, seguridad, login del dentista y módulo molde de tratamientos). Las funcionalidades se implementan por tareas según [`docs/PLAN-IMPLEMENTACION.md`](docs/PLAN-IMPLEMENTACION.md). Estado vigente en [`docs/ai/STATUS.md`](docs/ai/STATUS.md).

## Por dónde empezar

| Documento | Qué es |
|---|---|
| Este README | Cómo levantar el proyecto en tu computadora |
| [`docs/PLAN-IMPLEMENTACION.md`](docs/PLAN-IMPLEMENTACION.md) | Tareas de implementación (base, tareas del equipo, cierre) y reglas de trabajo |
| [`docs/GUIA-MOLDE-MODULO.md`](docs/GUIA-MOLDE-MODULO.md) | Cómo construir un módulo nuevo copiando el molde de tratamientos |
| [`AGENTS.md`](AGENTS.md) | Reglas del proyecto y bootstrap obligatorio para agentes |
| [`docs/ai/`](docs/ai/) | Memoria versionada: PROTOCOL, MASTER, STATUS, HANDOFF, ROADMAP, DECISIONS |
| [`docs/VALIDACION-REQUISITOS.md`](docs/VALIDACION-REQUISITOS.md) | Reglas acordadas con el cliente y preguntas abiertas |
| [`docs/PLAN.md`](docs/PLAN.md) | Visión, alcance, arquitectura, pantallas y riesgos |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Modelo de datos y diagrama ER |
| [`docs/BRIEF-SISTEMA-DENTAL.md`](docs/BRIEF-SISTEMA-DENTAL.md) | Brief técnico y de método |
| [`docs/referencia/lumina-dental/`](docs/referencia/lumina-dental/README.md) | Demo ficticia «Lúmina Dental»: referencia visual, no funcionalidad real |

## Levantar el proyecto por primera vez

Todos los comandos se ejecutan en una **terminal normal** de tu computadora (Git Bash, PowerShell o la terminal de VS Code), **desde la carpeta raíz del repositorio**. Docker solo se usa para la base de datos: no hace falta entrar al contenedor.

### 1. Instalar los requisitos (una sola vez por computadora)

| Herramienta | Versión | Cómo comprobarla |
|---|---|---|
| Node.js | **24** (ver `.nvmrc`) | `node -v` → `v24.x` |
| pnpm | **12.18.0** | `pnpm -v` |
| Docker Desktop | cualquiera reciente | `docker info` (Docker Desktop debe estar **abierto**) |
| Git | cualquiera reciente | `git --version` |

Con [nvm-windows](https://github.com/coreybutler/nvm-windows): `nvm install 24` y `nvm use 24`. Luego `npm install -g pnpm@12.18.0`.

### 2. Clonar e instalar dependencias

```bash
git clone https://github.com/acallecoymbra-cpu/SistemaDental.git
cd SistemaDental
pnpm install
```

### 3. Crear el archivo de configuración local

```bash
cp .env.example .env            # Git Bash
# Copy-Item .env.example .env   # PowerShell
```

Los valores de `.env.example` sirven tal cual para desarrollo. El `.env` **nunca** se sube a Git.

### 4. Levantar la base de datos

```bash
pnpm db:up
```

Arranca PostgreSQL 17 en Docker con dos bases: `sistema_dental` (desarrollo) y `sistema_dental_test` (pruebas). Debe terminar con `Healthy`.

### 5. Compilar y crear las tablas

```bash
pnpm build
pnpm db:migrate
```

### 6. Crear la cuenta del dentista (una sola vez)

```bash
pnpm --filter @sistema-dental/api dentist:create --username dra.ejemplo --name "Dra. Ejemplo"
```

Muestra una **contraseña temporal una sola vez**: cópiala. En el primer ingreso el sistema pide cambiarla (mínimo 12 caracteres). Solo puede haber un dentista activo; si ya existe, el comando lo avisa y no crea otro.

### 7. Arrancar la aplicación

```bash
pnpm dev
```

| Dirección | Qué es |
|---|---|
| http://localhost:3000 | Portal público (tratamientos activos) |
| http://localhost:3000/panel | Panel del dentista (pide iniciar sesión) |
| http://localhost:3001/api/v1/health | Estado de la API y de la base de datos |

Para detener: `Ctrl + C`.

## Día a día

```bash
# Al empezar (si reiniciaste la computadora, primero abre Docker Desktop)
nvm use 24
pnpm db:up
pnpm dev

# Si alguien agregó migraciones o dependencias (por ejemplo, después de git pull)
pnpm install
pnpm build
pnpm db:migrate

# Al terminar (opcional)
pnpm db:down
```

## Pruebas y validaciones

Antes de abrir un Pull Request, todo debe estar en verde:

```bash
pnpm exec prettier --write .   # da formato
pnpm lint
pnpm typecheck
pnpm test                      # unitarias (sin base de datos)
pnpm test:integration          # contra PostgreSQL real (base *_test)
pnpm test:e2e                  # navegador real con Playwright (base *_e2e, puertos 3100/3101)
pnpm build
```

Antes de la primera ejecución de `pnpm test:e2e`, instala el navegador (una sola vez por computadora):

```bash
pnpm --filter @sistema-dental/web exec playwright install chromium
```

GitHub ejecuta las mismas validaciones en cada Pull Request; `main` no acepta cambios si alguna falla.

## Base de datos

La base solo cambia por **migraciones** (`apps/api/src/database/migrations`, `synchronize: false`).

```bash
# Crear una migración nueva (después escribir up() y down() a mano)
pnpm --filter @sistema-dental/api migration:create src/database/migrations/NombreDeLaMigracion

pnpm db:migrate                                      # aplicar pendientes
pnpm --filter @sistema-dental/api migration:show     # ver cuáles están aplicadas
pnpm --filter @sistema-dental/api migration:revert   # deshacer la última (solo en desarrollo)
```

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `failed to connect to the docker API` | Abre Docker Desktop, espera a que diga que está listo y repite `pnpm db:up` |
| La API dice `Unable to connect to the database` | Docker Desktop cerrado o base apagada: `pnpm db:up` |
| `Config validation error: "WEB_ORIGINS" is required` (u otra variable) | Falta en tu `.env`: compáralo con `.env.example` |
| `relation "..." does not exist` | Faltan migraciones: `pnpm build` y `pnpm db:migrate` |
| `node -v` muestra otra versión | `nvm use 24` |
| El panel vuelve siempre al login | Revisa que `COOKIE_SECURE=false` en tu `.env` (en local no hay HTTPS) |

## Estructura

```text
apps/api            API NestJS 11 (módulos en src/<modulo>/)
apps/web            Web Next.js 15 (portal en src/app, panel en src/app/panel)
packages/contracts  Tipos y constantes compartidos entre API y web
packages/config     Configuración compartida de TypeScript y ESLint
docs/               Documentación del proyecto
```

## Repositorio

Repositorio **público** en GitHub por decisión del propietario (ADR-008). Nunca se suben datos reales de pacientes, archivos clínicos, secretos ni el documento de requisitos del cliente. Cambios a `main` solo por Pull Request con la CI en verde y una aprobación.

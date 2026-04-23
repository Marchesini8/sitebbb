const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  try {
    await fs.access(APPLICATIONS_FILE);
  } catch {
    await fs.writeFile(APPLICATIONS_FILE, "[]", "utf8");
  }
}

async function readApplications() {
  await ensureStorage();
  const raw = await fs.readFile(APPLICATIONS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeApplications(applications) {
  await ensureStorage();
  await fs.writeFile(APPLICATIONS_FILE, JSON.stringify(applications, null, 2), "utf8");
}

function inferExtension(photoName, mimeType) {
  const extFromName = path.extname(photoName || "").toLowerCase();
  if (extFromName && [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extFromName)) {
    return extFromName;
  }

  switch ((mimeType || "").toLowerCase()) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".jpg";
  }
}

function extractBase64Payload(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

exports.saveApplication = async (payload) => {
  const photoPayload = extractBase64Payload(payload?.photoDataUrl);

  if (!photoPayload) {
    throw new Error("Foto inválida para upload.");
  }

  const extension = inferExtension(payload?.photoName, photoPayload.mimeType);
  const id = crypto.randomUUID();
  const filename = `${id}${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  const fileBuffer = Buffer.from(photoPayload.base64, "base64");

  await ensureStorage();
  await fs.writeFile(filePath, fileBuffer);

  const applications = await readApplications();
  const application = {
    id,
    createdAt: new Date().toISOString(),
    nome: payload?.nome || "",
    idade: payload?.idade || "",
    cpf: payload?.cpf || "",
    email: payload?.email || "",
    telefone: payload?.telefone || "",
    regiao: payload?.regiao || "",
    cidade: payload?.cidade || "",
    endereco: payload?.endereco || "",
    motivo: payload?.motivo || "",
    photoName: payload?.photoName || filename,
    photoUrl: `/uploads/${filename}`,
  };

  applications.unshift(application);
  await writeApplications(applications);

  return application;
};

exports.listApplications = async () => {
  return readApplications();
};

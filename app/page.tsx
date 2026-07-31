"use client";

import { ChangeEvent, FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type ReportType = "queja" | "sugerencia";

const OWNER_WHATSAPP = "51957722135"; // Reemplazar con el número real, incluyendo el código de país.
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "txt"]);

const initialForm = {
  name: "",
  dni: "",
  room: "",
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  detail: "",
};

export default function Home() {
  const [type, setType] = useState<ReportType>("queja");
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [sensorPermissionNeeded, setSensorPermissionNeeded] = useState(false);
  const [sensorActive, setSensorActive] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  function setTitleTilt(rotateX: number, rotateY: number) {
    titleRef.current?.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
    titleRef.current?.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
  }

  function handleOrientation(event: DeviceOrientationEvent) {
    if (event.beta === null || event.gamma === null) return;
    const rotateX = Math.max(-8, Math.min(8, (event.beta - 45) * -0.18));
    const rotateY = Math.max(-11, Math.min(11, event.gamma * 0.24));
    setTitleTilt(rotateX, rotateY);
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof DeviceOrientationEvent === "undefined") return;
    const orientationApi = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof orientationApi.requestPermission === "function") {
      setSensorPermissionNeeded(true);
      return () => window.removeEventListener("deviceorientation", handleOrientation, true);
    }

    window.addEventListener("deviceorientation", handleOrientation, true);
    setSensorActive(true);
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, []);

  async function enableMotionSensor() {
    const orientationApi = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (!orientationApi.requestPermission) return;

    try {
      const permission = await orientationApi.requestPermission();
      if (permission === "granted") {
        window.addEventListener("deviceorientation", handleOrientation, true);
        setSensorPermissionNeeded(false);
        setSensorActive(true);
      }
    } catch {
      setSensorPermissionNeeded(false);
    }
  }

  function handlePointerTilt(event: PointerEvent<HTMLHeadingElement>) {
    if (event.pointerType === "touch" || sensorActive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    setTitleTilt(vertical * -12, horizontal * 16);
  }

  const current = useMemo(
    () =>
      type === "queja"
        ? {
            label: "Queja",
            helper: "Cuéntenos qué ocurrió para poder atenderlo con prioridad.",
            placeholder: "Describa lo sucedido con el mayor detalle posible…",
          }
        : {
            label: "Sugerencia",
            helper: "Comparta una idea que nos ayude a mejorar su experiencia.",
            placeholder: "Escriba su sugerencia y cómo podríamos aplicarla…",
          },
    [type],
  );

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function validate() {
    if (!form.name.trim() || !form.room.trim() || !form.date || !form.time || !form.detail.trim()) {
      setStatus("Complete todos los campos obligatorios antes de continuar.");
      return false;
    }
    if (!/^\d{8}$/.test(form.dni)) {
      setStatus("Ingrese un DNI válido de 8 dígitos.");
      return false;
    }
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_FILE_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
        setStatus("El tipo de archivo no está permitido. Use JPG, PNG, WEBP, PDF, DOC, DOCX o TXT.");
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        setStatus("El archivo adjunto no debe superar los 10 MB.");
        return false;
      }
    }
    setStatus("");
    return true;
  }

  function buildMessage(includePdfNote = false) {
    const attachment = file
      ? `\n📎 Archivo seleccionado: ${cleanText(file.name)} (adjuntarlo en este chat)`
      : "\n📎 Archivo adjunto: ninguno";
    const pdfNote = includePdfNote
      ? "\n\n📄 He generado el PDF con todos los datos. Lo adjuntaré a continuación."
      : "";

    return `*HOSPEDAJE GOLDEN GATE*\n*${current.label.toUpperCase()}*\n\n👤 Nombre: ${cleanText(form.name)}\n🪪 DNI: ${form.dni}\n🚪 Habitación: ${cleanText(form.room)}\n📅 Fecha: ${formatDate(form.date)}\n🕐 Hora: ${form.time}\n\n📝 Detalle:\n${cleanText(form.detail)}${attachment}${pdfNote}`;
  }

  function openWhatsApp(message: string) {
    window.open(
      `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function sendText(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `${current.label} - Hospedaje Golden Gate`,
          text: buildMessage(),
          files: [file],
        });
        setStatus("Archivo y formulario preparados para compartir por WhatsApp.");
        setShowSuccess(true);
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    openWhatsApp(buildMessage());
    setShowSuccess(true);
    setStatus(
      file
        ? "WhatsApp está listo. Por seguridad, adjunte allí el archivo seleccionado antes de enviar."
        : "WhatsApp está listo para enviar el formulario.",
    );
  }

  async function createPdf() {
    if (!validate()) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const accent = type === "queja" ? [177, 57, 57] : [32, 126, 101];
    const gold = [184, 142, 45];

    doc.setFillColor(18, 18, 18);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("HOSPEDAJE GOLDEN GATE", 18, 18);
    doc.setFontSize(10);
    doc.setTextColor(245, 245, 245);
    doc.text("Registro de quejas y sugerencias", 18, 27);

    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(18, 48, 174, 15, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.text(current.label.toUpperCase(), 105, 57.8, { align: "center" });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    const rows = [
      ["Nombre", cleanText(form.name)],
      ["DNI", form.dni],
      ["Habitación", cleanText(form.room)],
      ["Fecha", formatDate(form.date)],
      ["Hora", form.time],
      ["Archivo seleccionado", file ? cleanText(file.name) : "Ninguno"],
    ];
    let y = 78;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 18, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 70, y);
      doc.setDrawColor(226, 220, 207);
      doc.line(18, y + 4, 192, y + 4);
      y += 13;
    });

    doc.setFont("helvetica", "bold");
    doc.text("Detalle", 18, y + 2);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(cleanText(form.detail), 174);
    doc.text(lines, 18, y + 11);

    if (file?.type.startsWith("image/")) {
      const dataUrl = await readFileAsDataUrl(file);
      const dimensions = await getImageDimensions(dataUrl);
      const maxWidth = 174;
      const maxHeight = 105;
      const scale = Math.min(
        maxWidth / dimensions.width,
        maxHeight / dimensions.height,
        1,
      );
      const imageWidth = dimensions.width * scale;
      const imageHeight = dimensions.height * scale;
      let imageY = y + 18 + lines.length * 5;

      if (imageY + imageHeight > 274) {
        doc.addPage();
        imageY = 30;
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Evidencia adjunta", 18, 20);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Evidencia adjunta", 18, imageY - 7);
      }

      const imageType = file.type.includes("png")
        ? "PNG"
        : file.type.includes("webp")
          ? "WEBP"
          : "JPEG";
      doc.addImage(dataUrl, imageType, 18, imageY, imageWidth, imageHeight);
    }

    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(
      "Documento generado desde el formulario de atención al huésped.",
      105,
      285,
      { align: "center" },
    );

    const pdfBlob = doc.output("blob");
    const pdfFile = new File(
      [pdfBlob],
      `${type}-golden-gate-${form.date}.pdf`,
      { type: "application/pdf" },
    );

    if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
      try {
        await navigator.share({
          title: `${current.label} - Hospedaje Golden Gate`,
          text: buildMessage(true),
          files: [pdfFile],
        });
        setStatus("PDF preparado para compartir.");
        setShowSuccess(true);
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    doc.save(pdfFile.name);
    openWhatsApp(buildMessage(true));
    setShowSuccess(true);
    setStatus(
      "El PDF se descargó y WhatsApp está abierto. Adjunte el PDF descargado en el chat.",
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-orbit orbit-three" />
        <div className="hero-orbit orbit-four" />
        <div className="hero-orbit orbit-five" />
        <div className="orbit-glow" aria-hidden="true" />
        <nav className="nav-shell" aria-label="Navegación principal">
          <a className="brand" href="#inicio" aria-label="Golden Gate, inicio">
            <span className="brand-mark">GG</span>
            <span>Golden Gate</span>
          </a>
          <a className="nav-link" href="#formulario">Enviar mensaje</a>
        </nav>

        <div className="hero-content" id="inicio">
          <p className="eyebrow"><span /> Su opinión nos importa</p>
          <h1
            ref={titleRef}
            className="hero-title-3d"
            onPointerMove={handlePointerTilt}
            onPointerLeave={() => !sensorActive && setTitleTilt(0, 0)}
          >
            Quejas y<br /><em>sugerencias</em>
          </h1>
          <p className="hero-copy">
            Cada comentario es una oportunidad para brindarle una estadía más
            cómoda, cálida y memorable.
          </p>
          <a className="hero-cta" href="#formulario">Compartir mi experiencia <span>↓</span></a>
          {sensorPermissionNeeded && (
            <button className="motion-permission" type="button" onClick={enableMotionSensor}>
              <span aria-hidden="true">✦</span> Activar efecto 3D
            </button>
          )}
        </div>

        <div className="hero-card" aria-label="Compromiso de atención">
          <span className="quote">“</span>
          <p>Escuchamos con atención.<br />Respondemos con compromiso.</p>
          <small>Atención directa con el propietario</small>
        </div>
      </section>

      <section className={`form-section ${type}`} id="formulario">
        <div className="section-heading">
          <p className="section-number">01 — SU EXPERIENCIA</p>
          <h2>¿Qué desea<br />compartirnos?</h2>
          <p>Seleccione una opción para personalizar su mensaje.</p>
        </div>

        <div className="form-panel">
          <div className="type-switch" role="group" aria-label="Tipo de mensaje">
            <button
              type="button"
              className={type === "queja" ? "active" : ""}
              aria-pressed={type === "queja"}
              onClick={() => setType("queja")}
            >
              <span className="type-icon">!</span>
              <span><strong>Presentar una queja</strong><small>Algo no estuvo como esperaba</small></span>
            </button>
            <button
              type="button"
              className={type === "sugerencia" ? "active" : ""}
              aria-pressed={type === "sugerencia"}
              onClick={() => setType("sugerencia")}
            >
              <span className="type-icon">✦</span>
              <span><strong>Compartir una sugerencia</strong><small>Tengo una idea para mejorar</small></span>
            </button>
          </div>

          <form onSubmit={sendText}>
            <div className="form-intro">
              <span>{current.label}</span>
              <p>{current.helper}</p>
            </div>

            <div className="field-grid">
              <label>
                <span>Nombre completo</span>
                <input name="name" value={form.name} onChange={updateField} placeholder="Ej. María Fernández" required autoComplete="name" maxLength={100} />
              </label>
              <label>
                <span>DNI</span>
                <input name="dni" value={form.dni} onChange={updateField} placeholder="8 dígitos" inputMode="numeric" maxLength={8} pattern="[0-9]{8}" required />
              </label>
              <label>
                <span>Número de habitación</span>
                <input name="room" value={form.room} onChange={updateField} placeholder="Ej. 204" required maxLength={20} />
              </label>
              <label>
                <span>Fecha</span>
                <input type="date" name="date" value={form.date} onChange={updateField} required />
              </label>
              <label>
                <span>Hora</span>
                <input type="time" name="time" value={form.time} onChange={updateField} required />
              </label>
            </div>

            <label className="detail-field">
              <span>Detalle de la {type}</span>
              <textarea name="detail" value={form.detail} onChange={updateField} placeholder={current.placeholder} rows={6} required maxLength={2000} />
              <small>{form.detail.length} caracteres</small>
            </label>

            <label className="file-drop">
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <span className="clip">＋</span>
              <span>
                <strong>{file ? file.name : "Adjuntar evidencia"}</strong>
                <small>{file ? formatSize(file.size) : "Imagen, PDF o documento · Máximo 10 MB"}</small>
              </span>
              <span className="browse">{file ? "Cambiar" : "Seleccionar"}</span>
            </label>

            <div className="privacy-note">
              <span>✓</span>
              <p><strong>Su información es confidencial.</strong> Los datos serán enviados directamente al propietario del hospedaje.</p>
            </div>

            {status && <p className="status" role="status">{status}</p>}

            <div className="actions">
              <button className="primary-action" type="submit">
                <span className="wa-dot">◉</span>
                Enviar texto por WhatsApp
                <span>→</span>
              </button>
              <button className="secondary-action" type="button" onClick={createPdf}>
                <span>▣</span>
                Generar y compartir PDF
              </button>
            </div>
            <p className="send-help">En teléfonos compatibles, el PDF se comparte directamente. En otros dispositivos, se descargará para adjuntarlo en WhatsApp.</p>
          </form>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">GG</span><span>Golden Gate</span></div>
        <p>Gracias por ayudarnos a mejorar su experiencia.</p>
        <small>© {new Date().getFullYear()} Hospedaje Golden Gate · Libro de atención digital</small>
      </footer>

      {showSuccess && (
        <div className="success-overlay" role="presentation">
          <section
            className="success-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-title"
          >
            <button
              className="success-close"
              type="button"
              aria-label="Cerrar mensaje"
              onClick={() => setShowSuccess(false)}
            >
              ×
            </button>
            <div className="success-seal" aria-hidden="true">
              <span>✓</span>
            </div>
            <p className="success-eyebrow">Hospedaje Golden Gate</p>
            <h2 id="success-title">Mensaje enviado<br /><em>con éxito</em></h2>
            <div className="success-line" />
            <p className="success-copy">
              Muchas gracias por ser parte de Hospedaje Golden Gate.
            </p>
            <button
              className="success-action"
              type="button"
              onClick={() => setShowSuccess(false)}
            >
              Continuar
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function formatDate(date: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function cleanText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(source: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    image.onerror = reject;
    image.src = source;
  });
}

/* global document */
import { Statistics } from "../types/statistics";
import { MarkType } from "../types";
import { getMarkTypeName, formatNumber } from "./markTypeHelpers";

interface PdfExportOptions {
  statistics: Statistics;
  shownTypes: MarkType[];
  metadata: { level?: string; class?: string };
  barChartSrc: string;
  donutChartSrc: string;
}

const A4_WIDTH_PX = 794; // A4 width at ~96dpi

const buildPdfHtmlContent = (options: PdfExportOptions): string => {
  const { statistics, shownTypes, metadata, barChartSrc, donutChartSrc } = options;

  const createdAt = new Date().toLocaleDateString("ar-MA");
  const metaLevel = metadata.level || "غير محدد";
  const metaClass = metadata.class || "غير محدد";

  // Build KPI items
  const kpiItems = statistics.overall
    ? [
        { label: "المتوسط العام", value: formatNumber(statistics.overall.overallAverage) },
        { label: "نسبة النجاح", value: `${Math.round((statistics.overall.passRate || 0) * 100)}%` },
        { label: "نسبة الرسوب", value: `${Math.round((statistics.overall.failRate || 0) * 100)}%` },
        { label: "إجمالي التلاميذ", value: String(statistics.totalStudents) },
        { label: "النقاط المحسوبة", value: String(statistics.overall.totalMarksCounted) },
      ]
    : [];

  // Build mastery items
  const masteryItems = statistics.mastery
    ? [
        {
          label: "المتحكمون (≥ 15)",
          value: `${statistics.mastery.masteredPct}% — ${statistics.mastery.masteredCount}/${statistics.totalStudents}`,
        },
        {
          label: "في طور التحكم (10 - 14.99)",
          value: `${statistics.mastery.inProgressPct}% — ${statistics.mastery.inProgressCount}/${statistics.totalStudents}`,
        },
        {
          label: "غير متحكمين (< 10)",
          value: `${statistics.mastery.notMasteredPct}% — ${statistics.mastery.notMasteredCount}/${statistics.totalStudents}`,
        },
      ]
    : [];

  // Build distributions HTML
  const distributionsHtml = shownTypes
    .map((type) => {
      const dist = statistics.distribution[type];
      if (!dist) return "";

      const max = Math.max(dist["15-20"], dist["10-15"], dist["5-10"], dist["0-5"]);

      const buildDistRow = (label: string, value: number, color: string) => {
        const pct = max > 0 ? Math.round((value / max) * 100) : 0;
        return `
          <div class="dist-row">
            <div class="dist-label">${label}</div>
            <div class="dist-count">${value} تلميذ</div>
            <div class="dist-bar"><span style="width:${pct}%;background:${color}"></span></div>
          </div>`;
      };

      return `
        <div class="card" style="page-break-inside: avoid">
          <div class="card-title">${getMarkTypeName(type)}</div>
          ${buildDistRow("ممتاز (16-20)", dist["15-20"], "#10b981")}
          ${buildDistRow("جيد جداً (13-15.9)", dist["10-15"], "#3b82f6")}
          ${buildDistRow("مقبول (10-12.9)", dist["5-10"], "#f59e0b")}
          ${buildDistRow("ضعيف (0-9.9)", dist["0-5"], "#ef4444")}
        </div>`;
    })
    .join("");

  // Build top students HTML
  const topStudentsHtml = shownTypes
    .map((type) => {
      const items = (statistics.topStudentsByType?.[type] || []).slice(0, 3);
      if (items.length === 0) return "";

      const rows = items
        .map(
          (s, idx) => `
          <tr>
            <td class="rank">${idx + 1}</td>
            <td>${s.name}</td>
            <td class="score">${formatNumber(s.value)}</td>
          </tr>`
        )
        .join("");

      return `
        <div class="card">
          <div class="card-title">${getMarkTypeName(type)} - المتفوقون</div>
          <table class="table">
            <thead><tr><th>#</th><th>الاسم</th><th>النقطة</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  // Build difficulty students HTML
  const difficultyStudentsHtml = shownTypes
    .map((type) => {
      const items = (statistics.bottomStudentsByType?.[type] || []).filter((s) => s.value < 10).slice(0, 10);
      if (items.length === 0) return "";

      const rows = items
        .map(
          (s, idx) => `
          <tr>
            <td class="rank">${idx + 1}</td>
            <td>${s.name}</td>
            <td class="score low">${formatNumber(s.value)}</td>
          </tr>`
        )
        .join("");

      return `
        <div class="card">
          <div class="card-title">${getMarkTypeName(type)} - التلاميذ في صعوبة</div>
          <table class="table danger">
            <thead><tr><th>#</th><th>الاسم</th><th>النقطة</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  // Build recommendations HTML
  const recommendationsHtml = (statistics.recommendations || []).map((rec) => `<li>${rec}</li>`).join("");

  return `
    <style>
      .header { text-align:center; margin-bottom:16px; }
      .title { font-size:26px; font-weight:700; color:#0e7c42; }
      .subtitle { color:#64748b; margin-top:4px; }
      .meta { display:flex; gap:12px; justify-content:space-between; background:#f8fafc; border:1px dashed rgba(14,124,66,.35); border-radius:8px; padding:10px 12px; margin:12px 0; }
      .meta .pair { display:flex; gap:6px; align-items:center; }
      .section { margin-top:18px; page-break-inside: avoid; }
      .section h3 { margin:0 0 10px 0; font-size:18px; color:#1e293b; }
      .grid { display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; }
      .grid-3 { display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; }
      .card { border:1px solid rgba(14,124,66,.15); border-radius:12px; padding:14px; background:linear-gradient(135deg,#fff,#f8fafc); }
      .kpi { display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
      .kpi .label { font-size:13px; color:#64748b; }
      .kpi .value { font-size:22px; font-weight:700; color:#0e7c42; }
      .card-title { font-weight:700; margin-bottom:10px; color:#1e293b; }
      .charts { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
      .chart { border:1px solid rgba(14,124,66,.12); border-radius:10px; padding:8px; text-align:center; }
      .chart img { width:100%; height:auto; }
      .dist-row { display:grid; grid-template-columns: auto 100px 1fr; gap:10px; align-items:center; margin:10px 0; }
      .dist-label { color:#1e293b; }
      .dist-count { color:#0e7c42; font-weight:700; text-align:center; }
      .dist-bar { background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden; }
      .dist-bar span { display:block; height:100%; border-radius:4px; }
      .table { width:100%; border-collapse: collapse; }
      .table th, .table td { border-bottom:1px solid #e5e7eb; padding:8px; }
      .table th { background:#f1f5f9; text-align:center; color:#0f172a; }
      .table td { text-align:center; }
      .table .rank { width:48px; font-weight:700; }
      .table .score { font-weight:700; color:#0e7c42; }
      .table.danger .score.low { color:#ef4444; }
      .recs { list-style: none; padding:0; margin:0; display:grid; gap:8px; }
      .recs li { background: rgba(14,124,66,.06); border-left:4px solid #0e7c42; padding:10px 12px; border-radius:6px; }
      .footer { margin-top:18px; font-size:12px; color:#94a3b8; text-align:center; }
    </style>
    <div class="header">
      <div class="title">MarkFiller - تقرير الإحصائيات</div>
      <div class="subtitle">تحليل شامل لنتائج التلاميذ</div>
    </div>
    <div class="meta">
      <div class="pair"><span>المستوى:</span><strong>${metaLevel}</strong></div>
      <div class="pair"><span>القسم:</span><strong>${metaClass}</strong></div>
      <div class="pair"><span>تاريخ الإنشاء:</span><strong>${createdAt}</strong></div>
    </div>
    ${
      kpiItems.length
        ? `<div class="section"><h3>ملخص الإحصائيات</h3><div class="grid-3">${kpiItems
            .map(
              (i) =>
                `<div class="card kpi"><div class="label">${i.label}</div><div class="value">${i.value}</div></div>`
            )
            .join("")}${
            masteryItems.length
              ? masteryItems
                  .map(
                    (i) =>
                      `<div class="card kpi"><div class="label">${i.label}</div><div class="value">${i.value}</div></div>`
                  )
                  .join("")
              : ""
          }</div></div>`
        : ""
    }
    <div class="section">
      <h3>الرسوم البيانية</h3>
      <div class="charts">
        ${barChartSrc ? `<div class="chart"><img src="${barChartSrc}" alt="bar" /></div>` : ""}
        ${donutChartSrc ? `<div class="chart"><img src="${donutChartSrc}" alt="donut" /></div>` : ""}
      </div>
    </div>
    <div class="section">
      <h3>توزيع الدرجات</h3>
      <div class="grid">${distributionsHtml}</div>
    </div>
    <div class="section">
      <h3>المتفوقون الثلاثة الأوائل</h3>
      <div class="grid">${topStudentsHtml}</div>
    </div>
    <div class="section">
      <h3>التلاميذ في صعوبة (متوسط أقل من 10)</h3>
      <div class="grid">${difficultyStudentsHtml}</div>
    </div>
    ${
      recommendationsHtml
        ? `<div class="section"><h3>توصيات تحسين الأداء</h3><ul class="recs">${recommendationsHtml}</ul></div>`
        : ""
    }
    <div class="footer">تم إنشاء هذا التقرير بواسطة MarkFiller</div>
  `;
};

export const generatePdfReport = async (reportRef: HTMLDivElement, options: PdfExportOptions): Promise<void> => {
  try {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);

    // Prepare chart snapshots
    const chartCanvases = reportRef.querySelectorAll("canvas");
    const barChartSrc = chartCanvases[0] ? (chartCanvases[0] as HTMLCanvasElement).toDataURL("image/png") : "";
    const donutChartSrc = chartCanvases[1] ? (chartCanvases[1] as HTMLCanvasElement).toDataURL("image/png") : "";

    // Create off-screen container
    const container = document.createElement("div");
    container.id = "markfiller-pdf-report";
    container.style.cssText = [
      "position: fixed",
      "left: -10000px",
      "top: 0",
      `width: ${A4_WIDTH_PX}px`,
      "box-sizing: border-box",
      "background: #ffffff",
      "color: #0f172a",
      "direction: rtl",
      "padding: 24px",
      "font-family: 'Segoe UI', Tahoma, 'Cairo', 'Noto Naskh Arabic', Arial, sans-serif",
      "line-height: 1.5",
    ].join(";");

    container.innerHTML = buildPdfHtmlContent({ ...options, barChartSrc, donutChartSrc });
    document.body.appendChild(container);

    // Render to canvas
    const canvas = await html2canvas(container, {
      scale: Math.max(2, Math.ceil(window.devicePixelRatio || 2)),
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      windowWidth: A4_WIDTH_PX,
    });

    // Clean up container
    document.body.removeChild(container);

    // Create PDF
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const mmPerPixel = imgWidth / canvas.width;
    const printableHeightMm = pageHeight - margin * 2;
    const sliceHeightPx = Math.floor(printableHeightMm / mmPerPixel);

    let y = 0;
    let isFirstPage = true;

    while (y < canvas.height) {
      const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - y);

      // Create slice canvas
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceHeightPx;
      const ctx = sliceCanvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(canvas, 0, y, canvas.width, currentSliceHeightPx, 0, 0, canvas.width, currentSliceHeightPx);
      }

      const sliceData = sliceCanvas.toDataURL("image/png");
      const sliceHeightMm = currentSliceHeightPx * mmPerPixel;

      if (!isFirstPage) {
        pdf.addPage();
      }
      pdf.addImage(sliceData, "PNG", margin, margin, imgWidth, sliceHeightMm, "", "FAST");

      isFirstPage = false;
      y += currentSliceHeightPx;
    }

    // Generate filename
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}_${String(now.getMonth() + 1).padStart(2, "0")}_${now.getFullYear()}`;
    const safeClass = (options.metadata.class || "غير محدد")
      .toString()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");

    pdf.save(`MarkFiller-Statistics-${safeClass}_${dateStr}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

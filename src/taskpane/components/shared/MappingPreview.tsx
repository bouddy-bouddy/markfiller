import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Card,
  Text,
  Button,
  Spinner,
  ProgressBar,
  Combobox,
  Option,
} from "@fluentui/react-components";
import {
  ErrorCircle24Regular,
  Warning24Regular,
  Eye24Regular,
  ArrowRight24Regular,
} from "@fluentui/react-icons";
import excelService from "../../services/excel/excelService";
import { Student, DetectedMarkTypes, MarkType, markTypeNames } from "../../types";
import { logger } from "../../utils/logger";
import { MappingPreviewTable } from "./MappingPreviewTable";
import * as S from "./MappingPreview.styles";

/**
 * Optimized MappingPreview Component
 * Features: debouncing, pagination, memoization, separated styled components
 */

// Pagination constants
const PAGE_SIZE = 50;
const DEBOUNCE_DELAY = 300;

interface MappingPreviewProps {
  extractedData: Student[];
  detectedMarkTypes: DetectedMarkTypes;
  onConfirmMapping: () => Promise<void>;
  onCancel: () => void;
  isInserting?: boolean;
}

interface MappingPreviewData {
  mappingPreview: Array<{
    studentName: string;
    studentFound: boolean;
    excelRow?: number;
    mappings: Array<{
      markType: MarkType;
      extractedValue: number | null;
      targetColumn: number;
      targetColumnHeader: string;
      willInsert: boolean;
    }>;
  }>;
  summary: {
    totalStudents: number;
    studentsFound: number;
    studentsNotFound: number;
    totalMarksToInsert: number;
  };
}

const MappingPreview: React.FC<MappingPreviewProps> = ({
  extractedData,
  detectedMarkTypes,
  onConfirmMapping,
  onCancel,
  isInserting = false,
}) => {
  const [mappingData, setMappingData] = useState<MappingPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickFillType, setQuickFillType] = useState<MarkType>("fard1");
  const [isQuickFilling, setIsQuickFilling] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Debouncing timeout ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized detected mark types
  const detectedMarkTypesArray = useMemo<MarkType[]>(() => {
    const types: MarkType[] = [];
    if (detectedMarkTypes.hasFard1) types.push("fard1");
    if (detectedMarkTypes.hasFard2) types.push("fard2");
    if (detectedMarkTypes.hasFard3) types.push("fard3");
    if (detectedMarkTypes.hasFard4) types.push("fard4");
    if (detectedMarkTypes.hasActivities) types.push("activities");
    return types;
  }, [detectedMarkTypes]);

  // Memoized mark type display names
  const markTypeDisplayNames = useMemo(() => markTypeNames, []);

  // Set default quick fill type
  useEffect(() => {
    if (detectedMarkTypesArray.length > 0 && quickFillType !== detectedMarkTypesArray[0]) {
      setQuickFillType(detectedMarkTypesArray[0]);
    }
  }, [detectedMarkTypesArray]);

  // Debounced load mapping preview
  const loadMappingPreview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentPage(1); // Reset to first page

      logger.debug("🔍 Loading mapping preview...");
      const preview = await excelService.previewMapping(extractedData, detectedMarkTypes);

      logger.debug("📊 Mapping preview loaded:", preview);
      setMappingData(preview);
    } catch (err) {
      logger.error("Mapping preview error:", err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء معاينة التطابق");
    } finally {
      setIsLoading(false);
    }
  }, [extractedData, detectedMarkTypes]);

  // Debounced effect for loading mapping preview
  useEffect(() => {
    // Clear existing timeout
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timeout
    debounceTimerRef.current = setTimeout(() => {
      loadMappingPreview();
    }, DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [loadMappingPreview]);

  // Pagination calculations
  const totalPages = useMemo(() => {
    if (!mappingData) return 1;
    return Math.ceil(mappingData.mappingPreview.length / PAGE_SIZE);
  }, [mappingData]);

  // Current page data
  const currentPageData = useMemo(() => {
    if (!mappingData) return [];
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return mappingData.mappingPreview.slice(startIndex, endIndex);
  }, [mappingData, currentPage]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle quick fill
  const handleQuickFill = useCallback(async () => {
    try {
      setIsQuickFilling(true);
      await excelService.insertMarksFromSelection(extractedData, quickFillType);
    } catch (err) {
      logger.error("Quick fill error:", err);
      setError("تعذر الإدخال انطلاقًا من الخلية المحددة. تأكد من تحديد الخلية الأولى في Excel.");
    } finally {
      setIsQuickFilling(false);
    }
  }, [extractedData, quickFillType]);

  if (isLoading) {
    return (
      <S.MappingContainer>
        <S.LoadingContainer>
          <Spinner size="large" />
          <Text size={400} weight="semibold">
            جاري تحليل التطابق مع ملف Excel...
          </Text>
          <Text size={300} style={{ color: "#64748b" }}>
            يتم التحقق من أسماء التلاميذ والأعمدة المناسبة
          </Text>
        </S.LoadingContainer>
      </S.MappingContainer>
    );
  }

  if (error) {
    return (
      <S.MappingContainer>
        <Card style={{ padding: "20px", textAlign: "center" }}>
          <ErrorCircle24Regular style={{ color: "#ef4444", fontSize: "48px", marginBottom: "16px" }} />
          <Text size={500} weight="semibold" style={{ color: "#ef4444", display: "block", marginBottom: "8px" }}>
            خطأ في معاينة التطابق
          </Text>
          <Text size={300} style={{ color: "#64748b", marginBottom: "20px", display: "block" }}>
            {error}
          </Text>
          <Button appearance="secondary" onClick={loadMappingPreview}>
            إعادة المحاولة
          </Button>
        </Card>
      </S.MappingContainer>
    );
  }

  if (!mappingData) {
    return null;
  }

  const { summary } = mappingData;

  return (
    <S.MappingContainer>
      {/* Summary Card */}
      <S.SummaryCard>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <Eye24Regular style={{ color: "#0e7c42", fontSize: "24px" }} />
          <Text size={500} weight="semibold" style={{ color: "#0e7c42" }}>
            معاينة التطابق مع ملف مسار
          </Text>
        </div>

        <Text size={300} style={{ color: "#64748b", marginBottom: "16px", display: "block" }}>
          تحقق من التطابق قبل إدخال العلامات في ملف Excel
        </Text>

        <S.SummaryGrid>
          <S.SummaryItem>
            <S.SummaryNumber>{summary.totalStudents}</S.SummaryNumber>
            <S.SummaryLabel>إجمالي التلاميذ</S.SummaryLabel>
          </S.SummaryItem>

          <S.SummaryItem>
            <S.SummaryNumber style={{ color: "#10b981" }}>{summary.studentsFound}</S.SummaryNumber>
            <S.SummaryLabel>تلاميذ موجودون</S.SummaryLabel>
          </S.SummaryItem>

          <S.SummaryItem>
            <S.SummaryNumber style={{ color: "#ef4444" }}>{summary.studentsNotFound}</S.SummaryNumber>
            <S.SummaryLabel>تلاميذ غير موجودين</S.SummaryLabel>
          </S.SummaryItem>
        </S.SummaryGrid>
      </S.SummaryCard>

      {/* Mapping Table with Pagination - Optimized Component */}
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 0 20px" }}>
          <Text size={400} weight="semibold" style={{ color: "#0e7c42" }}>
            تفاصيل التطابق
          </Text>
        </div>

        <MappingPreviewTable
          mappingPreview={currentPageData}
          detectedMarkTypes={detectedMarkTypesArray}
          markTypeDisplayNames={markTypeDisplayNames}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          totalStudents={mappingData.mappingPreview.length}
          onPageChange={handlePageChange}
        />
      </Card>

      {/* Quick Fill from current selection */}
      <Card style={{ padding: "16px" }}>
        <Text size={400} weight="semibold" style={{ color: "#0e7c42" }}>
          إدخال سريع من الخلية المحددة في Excel
        </Text>
        <Text size={300} style={{ color: "#64748b", display: "block", margin: "6px 0 12px" }}>
          اختر نوع العلامة، ثم حدِّد في ملف Excel الخلية الأولى حيث يجب وضع علامة أول تلميذ، وبعدها اضغط «إدخال من
          الخلية المحددة». سيتم تعبئة باقي العلامات أسفلها مباشرةً.
        </Text>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text size={300} style={{ color: "#334155" }}>
              نوع العلامة:
            </Text>
            <Combobox
              aria-label="نوع العلامة"
              selectedOptions={[quickFillType]}
              value={markTypeDisplayNames[quickFillType]}
              onOptionSelect={(_, data) => setQuickFillType((data.optionValue || quickFillType) as MarkType)}
              style={{ minWidth: 220 }}
            >
              {detectedMarkTypesArray.map((t) => (
                <Option key={t} value={t}>
                  {markTypeDisplayNames[t]}
                </Option>
              ))}
            </Combobox>
          </div>

          <S.PrimaryButton onClick={handleQuickFill} disabled={isInserting || isQuickFilling} style={{ color: "#fff" }}>
            {isQuickFilling ? "جاري الإدخال..." : "إدخال من الخلية المحددة"}
          </S.PrimaryButton>
        </div>
      </Card>

      {/* Warning for missing students */}
      {summary.studentsNotFound > 0 && (
        <Card
          style={{
            padding: "16px",
            background: "rgba(245, 158, 11, 0.05)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <Warning24Regular style={{ color: "#f59e0b", fontSize: "20px", marginTop: "2px" }} />
            <div>
              <Text size={400} weight="semibold" style={{ color: "#f59e0b", display: "block", marginBottom: "4px" }}>
                تحذير: بعض التلاميذ غير موجودين في ملف Excel
              </Text>
              <Text size={300} style={{ color: "#92400e" }}>
                {summary.studentsNotFound} من أصل {summary.totalStudents} من التلاميذ غير موجودين في ملف مسار. تأكد من
                أن أسماء التلاميذ في الصورة تطابق الأسماء في ملف Excel.
              </Text>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <S.ActionButtons>
        <S.PrimaryButton
          appearance="primary"
          onClick={onConfirmMapping}
          disabled={isInserting}
          icon={<ArrowRight24Regular />}
          style={{ color: "#fff" }}
        >
          {"متابعة"}
        </S.PrimaryButton>

        <S.SecondaryButton appearance="secondary" onClick={onCancel} disabled={isInserting}>
          إلغاء
        </S.SecondaryButton>
      </S.ActionButtons>

      {/* Progress bar for insertion */}
      {isInserting && (
        <div style={{ marginTop: "16px" }}>
          <Text size={300} style={{ color: "#64748b", marginBottom: "8px", display: "block" }}>
            جاري إدخال العلامات في ملف Excel...
          </Text>
          <ProgressBar />
        </div>
      )}
    </S.MappingContainer>
  );
};

export default MappingPreview;

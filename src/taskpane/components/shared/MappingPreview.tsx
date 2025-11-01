import React, { useState, useEffect } from "react";
import {
  Card,
  Text,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Spinner,
  ProgressBar,
  Combobox,
  Option,
} from "@fluentui/react-components";
import {
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Warning24Regular,
  Info24Regular,
  Eye24Regular,
  ArrowRight24Regular,
} from "@fluentui/react-icons";
import styled from "styled-components";
import excelService from "../../services/excel/excelService";
import { Student, DetectedMarkTypes, MarkType, markTypeNames } from "../../types";

const MappingContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 20px;
`;

const SummaryCard = styled(Card)`
  padding: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const SummaryNumber = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: #0e7c42;
  margin-bottom: 4px;
`;

const SummaryLabel = styled(Text)`
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
`;

const MappingTable = styled(Table)`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const StudentRow = styled(TableRow)<{ found: boolean }>`
  background: ${(props) => (props.found ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)")};

  &:hover {
    background: ${(props) => (props.found ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)")};
  }
`;

const MarkCell = styled(TableCell)<{ willInsert: boolean }>`
  text-align: center;
  font-weight: ${(props) => (props.willInsert ? "600" : "400")};
  color: ${(props) => (props.willInsert ? "#0e7c42" : "#94a3b8")};
`;

const StatusBadge = styled(Badge)<{ status: "success" | "error" | "warning" }>`
  background: ${(props) => {
    switch (props.status) {
      case "success":
        return "rgba(16, 185, 129, 0.1)";
      case "error":
        return "rgba(239, 68, 68, 0.1)";
      case "warning":
        return "rgba(245, 158, 11, 0.1)";
      default:
        return "rgba(156, 163, 175, 0.1)";
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "success":
        return "#10b981";
      case "error":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      default:
        return "#9ca3af";
    }
  }};
  border: 1px solid
    ${(props) => {
      switch (props.status) {
        case "success":
          return "rgba(16, 185, 129, 0.2)";
        case "error":
          return "rgba(239, 68, 68, 0.2)";
        case "warning":
          return "rgba(245, 158, 11, 0.2)";
        default:
          return "rgba(156, 163, 175, 0.2)";
      }
    }};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 16px;
  justify-content: flex-start;
  margin-top: 20px;
`;

const PrimaryButton = styled(Button)`
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 8px 16px -4px rgba(14, 124, 66, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  min-width: 140px !important;

  &:hover:not(:disabled) {
    transform: translateY(-2px) !important;
    box-shadow: 0 16px 24px -4px rgba(14, 124, 66, 0.4) !important;
  }

  &:active:not(:disabled) {
    transform: translateY(0) !important;
  }
`;

const SecondaryButton = styled(Button)`
  border-radius: 12px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  min-width: 100px !important;

  &:hover:not(:disabled) {
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  text-align: center;
`;

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

  useEffect(() => {
    loadMappingPreview();
  }, [extractedData, detectedMarkTypes]);

  const loadMappingPreview = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("🔍 Loading mapping preview...");
      const preview = await excelService.previewMapping(extractedData, detectedMarkTypes);

      console.log("📊 Mapping preview loaded:", preview);
      setMappingData(preview);
    } catch (err) {
      console.error("Mapping preview error:", err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء معاينة التطابق");
    } finally {
      setIsLoading(false);
    }
  };

  const getMarkTypeDisplayName = (markType: MarkType): string => markTypeNames[markType];

  const getDetectedMarkTypes = (): MarkType[] => {
    const detectedTypes: MarkType[] = [];
    if (detectedMarkTypes.hasFard1) detectedTypes.push("fard1");
    if (detectedMarkTypes.hasFard2) detectedTypes.push("fard2");
    if (detectedMarkTypes.hasFard3) detectedTypes.push("fard3");
    if (detectedMarkTypes.hasFard4) detectedTypes.push("fard4");
    if (detectedMarkTypes.hasActivities) detectedTypes.push("activities");
    return detectedTypes;
  };

  useEffect(() => {
    const detected = getDetectedMarkTypes();
    if (detected.length > 0) {
      setQuickFillType(detected[0]);
    }
  }, [detectedMarkTypes]);

  const handleQuickFill = async () => {
    try {
      setIsQuickFilling(true);
      await excelService.insertMarksFromSelection(extractedData, quickFillType);
    } catch (err) {
      console.error("Quick fill error:", err);
      setError("تعذر الإدخال انطلاقًا من الخلية المحددة. تأكد من تحديد الخلية الأولى في Excel.");
    } finally {
      setIsQuickFilling(false);
    }
  };

  const formatMarkValue = (value: number | null): string => {
    if (value === null) return "-";
    return value.toFixed(2);
  };

  if (isLoading) {
    return (
      <MappingContainer>
        <LoadingContainer>
          <Spinner size="large" />
          <Text size={400} weight="semibold">
            جاري تحليل التطابق مع ملف Excel...
          </Text>
          <Text size={300} style={{ color: "#64748b" }}>
            يتم التحقق من أسماء التلاميذ والأعمدة المناسبة
          </Text>
        </LoadingContainer>
      </MappingContainer>
    );
  }

  if (error) {
    return (
      <MappingContainer>
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
      </MappingContainer>
    );
  }

  if (!mappingData) {
    return null;
  }

  const { mappingPreview, summary } = mappingData;

  return (
    <MappingContainer>
      {/* Summary Card */}
      <SummaryCard>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <Eye24Regular style={{ color: "#0e7c42", fontSize: "24px" }} />
          <Text size={500} weight="semibold" style={{ color: "#0e7c42" }}>
            معاينة التطابق مع ملف مسار
          </Text>
        </div>

        <Text size={300} style={{ color: "#64748b", marginBottom: "16px", display: "block" }}>
          تحقق من التطابق قبل إدخال العلامات في ملف Excel
        </Text>

        <SummaryGrid>
          <SummaryItem>
            <SummaryNumber>{summary.totalStudents}</SummaryNumber>
            <SummaryLabel>إجمالي التلاميذ</SummaryLabel>
          </SummaryItem>

          <SummaryItem>
            <SummaryNumber style={{ color: "#10b981" }}>{summary.studentsFound}</SummaryNumber>
            <SummaryLabel>تلاميذ موجودون</SummaryLabel>
          </SummaryItem>

          <SummaryItem>
            <SummaryNumber style={{ color: "#ef4444" }}>{summary.studentsNotFound}</SummaryNumber>
            <SummaryLabel>تلاميذ غير موجودين</SummaryLabel>
          </SummaryItem>
        </SummaryGrid>
      </SummaryCard>

      {/* Mapping Table */}
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 0 20px" }}>
          <Text size={400} weight="semibold" style={{ color: "#0e7c42" }}>
            تفاصيل التطابق
          </Text>
          {/* <Text size={300} style={{ color: "#64748b", marginTop: "4px", display: "block" }}>
            العلامات الملونة بالأخضر سيتم إدخالها، الرمادية لن يتم إدخالها
          </Text> */}
        </div>

        <div style={{ maxHeight: "400px", overflowY: "auto", margin: "16px" }}>
          <MappingTable>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>إسم التلميذ</TableHeaderCell>
                <TableHeaderCell>الحالة</TableHeaderCell>
                <TableHeaderCell>صف Excel</TableHeaderCell>
                {getDetectedMarkTypes().map((markType) => (
                  <TableHeaderCell key={markType} style={{ textAlign: "center" }}>
                    {getMarkTypeDisplayName(markType)}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappingPreview.map((student, index) => (
                <StudentRow key={index} found={student.studentFound}>
                  <TableCell>
                    <Text size={300} weight="semibold">
                      {student.studentName}
                    </Text>
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={student.studentFound ? "success" : "error"} size="small">
                      {student.studentFound ? (
                        <>
                          <CheckmarkCircle24Regular style={{ fontSize: "14px", marginLeft: "4px" }} />
                          موجود
                        </>
                      ) : (
                        <>
                          <ErrorCircle24Regular style={{ fontSize: "14px", marginLeft: "4px" }} />
                          غير موجود
                        </>
                      )}
                    </StatusBadge>
                  </TableCell>

                  <TableCell>
                    <Text size={300} style={{ color: student.studentFound ? "#0e7c42" : "#94a3b8" }}>
                      {student.excelRow !== undefined ? `صف ${student.excelRow + 1}` : "-"}
                    </Text>
                  </TableCell>

                  {getDetectedMarkTypes().map((markType) => {
                    const mapping = student.mappings.find((m) => m.markType === markType);
                    if (!mapping) return null;
                    return (
                      <MarkCell key={mapping.markType} willInsert={mapping.willInsert}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                          <Text size={300} weight={mapping.willInsert ? "semibold" : "regular"}>
                            {formatMarkValue(mapping.extractedValue)}
                          </Text>
                          {mapping.willInsert && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                color: "#64748b",
                              }}
                            >
                              <ArrowRight24Regular style={{ fontSize: "10px" }} />
                              <span>عمود {mapping.targetColumn + 1}</span>
                            </div>
                          )}
                        </div>
                      </MarkCell>
                    );
                  })}
                </StudentRow>
              ))}
            </TableBody>
          </MappingTable>
        </div>
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
              value={getMarkTypeDisplayName(quickFillType)}
              onOptionSelect={(_, data) => setQuickFillType((data.optionValue || quickFillType) as MarkType)}
              style={{ minWidth: 220 }}
            >
              {getDetectedMarkTypes().map((t) => (
                <Option key={t} value={t}>
                  {getMarkTypeDisplayName(t)}
                </Option>
              ))}
            </Combobox>
          </div>

          <PrimaryButton onClick={handleQuickFill} disabled={isInserting || isQuickFilling} style={{ color: "#fff" }}>
            {isQuickFilling ? "جاري الإدخال..." : "إدخال من الخلية المحددة"}
          </PrimaryButton>
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
      <ActionButtons>
        <PrimaryButton
          appearance="primary"
          onClick={onConfirmMapping}
          disabled={isInserting}
          icon={<ArrowRight24Regular />}
          style={{ color: "#fff" }}
        >
          {"متابعة"}
        </PrimaryButton>

        <SecondaryButton appearance="secondary" onClick={onCancel} disabled={isInserting}>
          إلغاء
        </SecondaryButton>
      </ActionButtons>

      {/* Progress bar for insertion */}
      {isInserting && (
        <div style={{ marginTop: "16px" }}>
          <Text size={300} style={{ color: "#64748b", marginBottom: "8px", display: "block" }}>
            جاري إدخال العلامات في ملف Excel...
          </Text>
          <ProgressBar />
        </div>
      )}
    </MappingContainer>
  );
};

export default MappingPreview;

import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Text,
  Checkbox,
  Spinner,
  Card,
  CardHeader,
  CardPreview,
} from "@fluentui/react-components";
import {
  DocumentText24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Info24Regular,
  ArrowSync24Regular,
} from "@fluentui/react-icons";
import { NameCorrectionResult, StudentNameCorrectionResults } from "../../services/studentNameCorrectionService";
import { Student } from "../../types";

interface StudentNameCorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  correctionResults: StudentNameCorrectionResults | null;
  onApplyCorrections: (corrections: NameCorrectionResult[]) => void;
  onSkipCorrections: () => void;
  isLoading?: boolean;
}

const StudentNameCorrectionDialog: React.FC<StudentNameCorrectionDialogProps> = ({
  isOpen,
  onClose,
  correctionResults,
  onApplyCorrections,
  onSkipCorrections,
  isLoading = false,
}) => {
  const [selectedCorrections, setSelectedCorrections] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState<boolean>(true);

  // Initialize with all corrections selected by default
  React.useEffect(() => {
    if (correctionResults && correctionResults.corrections.length > 0) {
      const allIndices = new Set(correctionResults.corrections.map((_, index) => index));
      setSelectedCorrections(allIndices);
      setSelectAll(true);
    }
  }, [correctionResults]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIndices = new Set(correctionResults?.corrections.map((_, index) => index) || []);
      setSelectedCorrections(allIndices);
      setSelectAll(true);
    } else {
      setSelectedCorrections(new Set());
      setSelectAll(false);
    }
  };

  const handleSelectCorrection = (index: number, checked: boolean) => {
    const newSelected = new Set(selectedCorrections);
    if (checked) {
      newSelected.add(index);
    } else {
      newSelected.delete(index);
    }
    setSelectedCorrections(newSelected);
    setSelectAll(newSelected.size === (correctionResults?.corrections.length || 0));
  };

  const handleApplySelected = () => {
    if (!correctionResults) return;

    const selectedCorrectionsList = correctionResults.corrections.filter((_, index) => selectedCorrections.has(index));

    onApplyCorrections(selectedCorrectionsList);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return "#10b981"; // Green
    if (confidence >= 0.8) return "#f59e0b"; // Yellow
    if (confidence >= 0.7) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.9) return "ممتاز";
    if (confidence >= 0.8) return "جيد جداً";
    if (confidence >= 0.7) return "جيد";
    return "ضعيف";
  };

  if (!correctionResults) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <DocumentText24Regular />
              تصحيح أسماء الطلاب
            </div>
          </DialogTitle>

          <DialogContent>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <Spinner size="large" />
                <Text>جاري تحليل البيانات...</Text>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                  <Card style={{ flex: 1 }}>
                    <CardHeader
                      image={<CheckmarkCircle24Regular style={{ color: "#10b981" }} />}
                      header={<Text weight="semibold">التصحيحات المقترحة</Text>}
                    />
                    <div style={{ padding: "16px" }}>
                      <Text size={500} weight="semibold" style={{ color: "#10b981" }}>
                        {correctionResults.totalCorrections}
                      </Text>
                    </div>
                  </Card>

                  <Card style={{ flex: 1 }}>
                    <CardHeader
                      image={<ErrorCircle24Regular style={{ color: "#ef4444" }} />}
                      header={<Text weight="semibold">غير متطابق</Text>}
                    />
                    <div style={{ padding: "16px" }}>
                      <Text size={500} weight="semibold" style={{ color: "#ef4444" }}>
                        {correctionResults.unmatchedStudents.length}
                      </Text>
                    </div>
                  </Card>

                  <Card style={{ flex: 1 }}>
                    <CardHeader
                      image={<Info24Regular style={{ color: "#3b82f6" }} />}
                      header={<Text weight="semibold">إجمالي الطلاب</Text>}
                    />
                    <div style={{ padding: "16px" }}>
                      <Text size={500} weight="semibold" style={{ color: "#3b82f6" }}>
                        {correctionResults.correctedStudents.length}
                      </Text>
                    </div>
                  </Card>
                </div>

                {/* Instructions */}
                <Card style={{ marginBottom: "24px" }}>
                  <div style={{ padding: "16px" }}>
                    <Text>
                      تم العثور على {correctionResults.totalCorrections} تصحيح محتمل لأسماء الطلاب. راجع التصحيحات أدناه
                      وحدد تلك التي تريد تطبيقها. يمكنك تخطي التصحيحات إذا كنت متأكداً من دقة الأسماء الأصلية.
                    </Text>
                  </div>
                </Card>

                {/* Select All Checkbox */}
                {correctionResults.corrections.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <Checkbox
                      checked={selectAll}
                      onChange={(_, data) => handleSelectAll(!!data.checked)}
                      label="تحديد الكل"
                    />
                  </div>
                )}

                {/* Corrections Table */}
                {correctionResults.corrections.length > 0 && (
                  <div
                    style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHeaderCell>تطبيق</TableHeaderCell>
                          <TableHeaderCell>الاسم الأصلي</TableHeaderCell>
                          <TableHeaderCell>الاسم المصحح</TableHeaderCell>
                          <TableHeaderCell>مستوى الثقة</TableHeaderCell>
                          <TableHeaderCell>صف مسار</TableHeaderCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {correctionResults.corrections.map((correction, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Checkbox
                                checked={selectedCorrections.has(index)}
                                onChange={(_, data) => handleSelectCorrection(index, !!data.checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <Text style={{ color: "#ef4444" }}>{correction.originalName}</Text>
                            </TableCell>
                            <TableCell>
                              <Text style={{ color: "#10b981" }}>{correction.correctedName}</Text>
                            </TableCell>
                            <TableCell>
                              <Badge appearance="filled" color={getConfidenceColor(correction.confidence) as any}>
                                {getConfidenceText(correction.confidence)} ({(correction.confidence * 100).toFixed(0)}%)
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Text>{correction.massarRowIndex}</Text>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Unmatched Students */}
                {correctionResults.unmatchedStudents.length > 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <Text weight="semibold" style={{ marginBottom: "12px", display: "block" }}>
                      الطلاب غير المتطابقين:
                    </Text>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        padding: "12px",
                        backgroundColor: "#fef2f2",
                        borderRadius: "8px",
                        border: "1px solid #fecaca",
                      }}
                    >
                      {correctionResults.unmatchedStudents.map((name, index) => (
                        <Badge key={index} appearance="filled" color="danger">
                          {name}
                        </Badge>
                      ))}
                    </div>
                    <Text size={200} style={{ marginTop: "8px", color: "#6b7280" }}>
                      لم يتم العثور على تطابق جيد لهؤلاء الطلاب في ملف مسار. قد تحتاج إلى مراجعة أسمائهم يدوياً.
                    </Text>
                  </div>
                )}
              </>
            )}
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={onSkipCorrections} disabled={isLoading}>
              تخطي التصحيحات
            </Button>
            <Button
              appearance="primary"
              onClick={handleApplySelected}
              disabled={isLoading || selectedCorrections.size === 0}
              icon={<CheckmarkCircle24Regular />}
            >
              تطبيق التصحيحات المحددة ({selectedCorrections.size})
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default StudentNameCorrectionDialog;

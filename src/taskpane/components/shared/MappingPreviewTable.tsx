import React, { memo, useMemo } from "react";
import {
  Text,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Button,
} from "@fluentui/react-components";
import {
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  ArrowRight24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
} from "@fluentui/react-icons";
import { MarkType } from "../../types";
import * as S from "./MappingPreview.styles";

/**
 * Optimized Mapping Preview Table with Pagination
 * Uses React.memo to prevent unnecessary re-renders
 */

interface StudentMapping {
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
}

interface MappingPreviewTableProps {
  mappingPreview: StudentMapping[];
  detectedMarkTypes: MarkType[];
  markTypeDisplayNames: Record<MarkType, string>;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalStudents: number;
  onPageChange: (page: number) => void;
}

const formatMarkValue = (value: number | null): string => {
  if (value === null) return "-";
  return value.toFixed(2);
};

export const MappingPreviewTable = memo<MappingPreviewTableProps>(
  ({
    mappingPreview,
    detectedMarkTypes,
    markTypeDisplayNames,
    currentPage,
    totalPages,
    pageSize,
    totalStudents,
    onPageChange,
  }) => {
    // Calculate pagination range
    const startIndex = useMemo(() => (currentPage - 1) * pageSize + 1, [currentPage, pageSize]);
    const endIndex = useMemo(
      () => Math.min(currentPage * pageSize, totalStudents),
      [currentPage, pageSize, totalStudents]
    );

    return (
      <>
        <div style={{ maxHeight: "500px", overflowY: "auto", margin: "16px" }}>
          <S.MappingTable>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>إسم التلميذ</TableHeaderCell>
                <TableHeaderCell>الحالة</TableHeaderCell>
                <TableHeaderCell>صف Excel</TableHeaderCell>
                {detectedMarkTypes.map((markType) => (
                  <TableHeaderCell key={markType} style={{ textAlign: "center" }}>
                    {markTypeDisplayNames[markType]}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappingPreview.map((student, index) => (
                <S.StudentRow key={index} found={student.studentFound}>
                  <TableCell>
                    <Text size={300} weight="semibold">
                      {student.studentName}
                    </Text>
                  </TableCell>

                  <TableCell>
                    <S.StatusBadge status={student.studentFound ? "success" : "error"} size="small">
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
                    </S.StatusBadge>
                  </TableCell>

                  <TableCell>
                    <Text size={300} style={{ color: student.studentFound ? "#0e7c42" : "#94a3b8" }}>
                      {student.excelRow !== undefined ? `صف ${student.excelRow + 1}` : "-"}
                    </Text>
                  </TableCell>

                  {detectedMarkTypes.map((markType) => {
                    const mapping = student.mappings.find((m) => m.markType === markType);
                    if (!mapping) return <TableCell key={markType}>-</TableCell>;
                    return (
                      <S.MarkCell key={mapping.markType} willInsert={mapping.willInsert}>
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
                      </S.MarkCell>
                    );
                  })}
                </S.StudentRow>
              ))}
            </TableBody>
          </S.MappingTable>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <S.PaginationContainer>
            <S.PaginationInfo>
              عرض {startIndex} - {endIndex} من أصل {totalStudents} تلميذ
            </S.PaginationInfo>
            <S.PaginationButtons>
              <Button
                appearance="subtle"
                icon={<ChevronRight24Regular />}
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                aria-label="الصفحة السابقة"
              />
              <Text size={300} weight="semibold" style={{ color: "#0e7c42", minWidth: "60px", textAlign: "center" }}>
                {currentPage} / {totalPages}
              </Text>
              <Button
                appearance="subtle"
                icon={<ChevronLeft24Regular />}
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                aria-label="الصفحة التالية"
              />
            </S.PaginationButtons>
          </S.PaginationContainer>
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.currentPage === nextProps.currentPage &&
      prevProps.totalPages === nextProps.totalPages &&
      prevProps.mappingPreview === nextProps.mappingPreview &&
      JSON.stringify(prevProps.detectedMarkTypes) === JSON.stringify(nextProps.detectedMarkTypes)
    );
  }
);

MappingPreviewTable.displayName = "MappingPreviewTable";


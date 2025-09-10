import React, { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Input,
  Tooltip,
} from "@fluentui/react-components";
import { Edit24Regular } from "@fluentui/react-icons";
import { Student, StudentMarks, DetectedMarkTypes } from "../../types";
import styled from "styled-components";

interface DataTableProps {
  data: Student[];
  onDataUpdate: (newData: Student[]) => void;
  detectedMarkTypes: DetectedMarkTypes;
  accuracyPercent?: number;
}

interface EditingCell {
  studentIndex: number;
  markType: keyof StudentMarks;
}

const TableContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
  border-radius: 16px;
  border: 2px solid rgba(14, 124, 66, 0.1);
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #0e7c42 0%, #10b981 100%);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #065f46 0%, #0e7c42 100%);
  }
`;

const StyledTable = styled(Table)`
  .fui-TableHeader {
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border-bottom: 2px solid rgba(14, 124, 66, 0.2);
  }

  .fui-TableHeaderCell {
    font-weight: 700 !important;
    color: #0e7c42 !important;
    padding: 16px 12px !important;
    font-size: 14px !important;
    text-align: center !important;
    border-right: 1px solid rgba(14, 124, 66, 0.1);

    &:last-child {
      border-right: none;
    }
    /* Narrow width for the first column (student number) */
    &:first-child {
      width: 60px !important;
      min-width: 60px !important;
      max-width: 60px !important;
      white-space: nowrap;
    }
    /* Right-align the student name header and tighten spacing */
    &:nth-child(2) {
      text-align: right !important;
      padding-right: 12px !important;
      padding-left: 8px !important;
      /* Strong vertical separator between name and marks */
      border-right: 2px solid rgba(14, 124, 66, 0.35);
    }
    /* Separator on the right side of the first mark column (between name and fard1) */
    &:nth-child(3) {
      border-right: 2px solid rgba(14, 124, 66, 0.35);
    }
  }

  .fui-TableRow {
    transition: all 0.2s ease;

    &:hover {
      background: linear-gradient(135deg, rgba(14, 124, 66, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%) !important;
      transform: scale(1.001);
    }
  }

  .fui-TableCell {
    padding: 12px !important;
    text-align: center !important;
    border-right: 1px solid rgba(14, 124, 66, 0.05);
    font-weight: 500 !important;

    &:last-child {
      border-right: none;
    }
    /* Match the first column width for body rows */
    &:first-child {
      width: 60px !important;
      min-width: 60px !important;
      max-width: 60px !important;
      white-space: nowrap;
    }
    /* Right-align the student name cells and tighten spacing */
    &:nth-child(2) {
      text-align: right !important;
      padding-right: 12px !important;
      padding-left: 8px !important;
      /* Strong vertical separator between name and marks */
      border-right: 2px solid rgba(14, 124, 66, 0.3);
    }
    /* Separator on the right side of the first mark column (between name and fard1) */
    &:nth-child(3) {
      border-right: 2px solid rgba(14, 124, 66, 0.3);
    }
  }
`;

const EditableCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: transparent;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(135deg, rgba(14, 124, 66, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const UncertainWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: rgba(254, 226, 226, 0.6);
`;

const MarkValue = styled.span`
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
`;

const CellActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const EditIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  border-radius: 6px;
  color: white;
  opacity: 0;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(14, 124, 66, 0.2);

  ${EditableCell}:hover & {
    opacity: 1;
  }
`;

const StyledInput = styled(Input)`
  width: 70px !important;
  border-radius: 8px !important;
  border: 2px solid #0e7c42 !important;
  font-weight: 600 !important;
  text-align: center !important;
  box-shadow: 0 4px 6px -1px rgba(14, 124, 66, 0.2) !important;

  &:focus {
    border-color: #10b981 !important;
    box-shadow: 0 0 0 3px rgba(14, 124, 66, 0.1) !important;
  }
`;

const DataTable: React.FC<DataTableProps> = ({ data, onDataUpdate, detectedMarkTypes, accuracyPercent }) => {
  const [editableData, setEditableData] = useState<Student[]>(data);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  // Update editableData when data changes
  useEffect(() => {
    console.log(
      "📊 DataTable: Received new data prop:",
      data.map((s) => s.name)
    );
    setEditableData(data);
    console.log("📊 DataTable: Updated editableData state");
  }, [data]);

  const validateMark = (value: string | null): boolean => {
    if (value === "" || value === null) return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 20;
  };

  const formatMark = (value: number | null): string => {
    if (value === null || value === undefined) return "";

    // Handle string values that might be passed
    let numValue: number;

    if (typeof value === "string") {
      numValue = parseFloat(value);
    } else {
      numValue = value;
    }

    if (isNaN(numValue)) return "";

    return numValue.toFixed(2);
  };

  const handleMarkEdit = (studentIndex: number, markType: keyof StudentMarks, value: string): boolean => {
    const newValue = value.trim() === "" ? null : parseFloat(value);

    if (newValue !== null && !validateMark(value)) {
      return false;
    }

    const newData = [...editableData];
    newData[studentIndex] = {
      ...newData[studentIndex],
      marks: {
        ...newData[studentIndex].marks,
        [markType]: newValue === null ? null : (parseFloat(newValue.toString()).toFixed(2) as unknown as number),
      },
      uncertain: {
        name: newData[studentIndex].uncertain?.name || false,
        marks: {
          ...(newData[studentIndex].uncertain?.marks || {}),
          [markType]: false,
        },
      },
    };

    setEditableData(newData);
    onDataUpdate(newData);
    return true;
  };

  const handleKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIndex: number,
    markType: keyof StudentMarks
  ) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLInputElement;
      const isValid = handleMarkEdit(studentIndex, markType, target.value);
      if (isValid) {
        setEditingCell(null);
      }
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const renderCell = (student: Student, index: number, markType: keyof StudentMarks) => {
    const isEditing = editingCell?.studentIndex === index && editingCell?.markType === markType;
    const value = student.marks[markType];
    const showUncertainty = typeof accuracyPercent === "number" && accuracyPercent < 100;
    const isUncertain = showUncertainty && !!student.uncertain?.marks?.[markType];

    if (isEditing) {
      return (
        <StyledInput
          autoFocus
          defaultValue={value !== null ? value.toString() : ""}
          onKeyDown={(e) => handleKeyPress(e, index, markType)}
          onBlur={(e) => {
            const isValid = handleMarkEdit(index, markType, e.target.value);
            if (isValid) {
              setEditingCell(null);
            }
          }}
        />
      );
    }

    return (
      <EditableCell onClick={() => setEditingCell({ studentIndex: index, markType })}>
        {isUncertain ? (
          <UncertainWrapper title="قيمة مشكوك في دقتها - يرجى المراجعة">
            <MarkValue style={{ color: "#991b1b" }}>{formatMark(value)}</MarkValue>
            <CellActions>
              <EditIcon>
                <Edit24Regular style={{ fontSize: "16px" }} />
              </EditIcon>
            </CellActions>
          </UncertainWrapper>
        ) : (
          <>
            <MarkValue>{formatMark(value)}</MarkValue>
            <CellActions>
              <EditIcon>
                <Edit24Regular style={{ fontSize: "16px" }} />
              </EditIcon>
            </CellActions>
          </>
        )}
      </EditableCell>
    );
  };

  // Helper function to get active mark types
  const getActiveMarkTypes = (): Array<{ key: keyof StudentMarks; label: string }> => {
    const toOrdinal = (n: 1 | 2 | 3 | 4) => {
      switch (n) {
        case 1:
          return "الأول";
        case 2:
          return "الثاني";
        case 3:
          return "الثالث";
        case 4:
          return "الرابع";
      }
    };

    const activeTypes: Array<{ key: keyof StudentMarks; label: string }> = [];

    if (detectedMarkTypes.hasFard1) {
      activeTypes.push({ key: "fard1", label: `الفرض ${toOrdinal(1)}` });
    }
    if (detectedMarkTypes.hasFard2) {
      activeTypes.push({ key: "fard2", label: `الفرض ${toOrdinal(2)}` });
    }
    if (detectedMarkTypes.hasFard3) {
      activeTypes.push({ key: "fard3", label: `الفرض ${toOrdinal(3)}` });
    }
    if (detectedMarkTypes.hasFard4) {
      activeTypes.push({ key: "fard4", label: `الفرض ${toOrdinal(4)}` });
    }
    if (detectedMarkTypes.hasActivities) {
      activeTypes.push({ key: "activities", label: "الأنشطة" });
    }

    return activeTypes;
  };

  // Helper function to get student name header
  const getStudentNameHeader = (): string => {
    // Check if any mark type contains "اسم", "الاسم", or "إسم" patterns
    const hasNamePattern = Object.values(detectedMarkTypes).some(
      (value) =>
        typeof value === "string" && (value.includes("اسم") || value.includes("الاسم") || value.includes("إسم"))
    );

    return "إسم التلميذ";
  };

  const activeMarkTypes = getActiveMarkTypes();

  return (
    <TableContainer>
      <StyledTable>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>رقم التلميذ</TableHeaderCell>
            <TableHeaderCell>{getStudentNameHeader()}</TableHeaderCell>
            {activeMarkTypes.map(({ key, label }) => (
              <TableHeaderCell key={key}>{label}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {editableData.map((student, index) => (
            <TableRow
              key={`student-${student.number}-${index}`}
              style={{
                backgroundColor: index % 2 === 0 ? "rgba(14, 124, 66, 0.02)" : "rgba(255, 255, 255, 0.8)",
              }}
            >
              <TableCell>{student.number}</TableCell>
              <TableCell>{student.name}</TableCell>
              {activeMarkTypes.map(({ key }) => (
                <TableCell key={key}>{renderCell(student, index, key)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </StyledTable>
    </TableContainer>
  );
};

export default DataTable;

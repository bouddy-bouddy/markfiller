import React, { useState } from "react";
import {
  Button,
  Text,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Input,
} from "@fluentui/react-components";
import { CheckmarkCircle24Regular, Edit24Regular } from "@fluentui/react-icons";
import { Student, StudentMarks } from "../types";
import styled from "styled-components";

const ButtonContainer = styled.div`
  margin-top: 20px;
  display: flex;
  gap: 16px;
  justify-content: flex-end;
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

interface DataPreviewProps {
  data: Student[];
  onConfirm: (data: Student[]) => void;
  onCancel: () => void;
  onDataUpdate: (data: Student[]) => void;
}

interface EditingCell {
  studentIndex: number;
  markType: keyof StudentMarks;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onConfirm, onCancel, onDataUpdate }) => {
  const [editableData, setEditableData] = useState<Student[]>(data);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  const formatMark = (value: number | null): string => {
    if (value === null) return "";

    // Ensure we're dealing with a number
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) return "";

    return numValue.toFixed(2);
  };

  const handleMarkEdit = (studentIndex: number, markType: keyof StudentMarks, value: string): boolean => {
    // Handle empty input
    if (value.trim() === "") {
      const newData = [...editableData];
      newData[studentIndex] = {
        ...newData[studentIndex],
        marks: {
          ...newData[studentIndex].marks,
          [markType]: null,
        },
      };

      setEditableData(newData);
      onDataUpdate(newData);
      return true;
    }

    // Convert to number and validate
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 20) {
      return false;
    }

    // Update data with proper number
    const newData = [...editableData];
    newData[studentIndex] = {
      ...newData[studentIndex],
      marks: {
        ...newData[studentIndex].marks,
        [markType]: numValue, // Store as number not string
      },
    };

    setEditableData(newData);
    onDataUpdate(newData);
    return true;
  };

  const handleKeyPress = (e: React.KeyboardEvent, studentIndex: number, markType: keyof StudentMarks): void => {
    if (e.key === "Enter") {
      const isValid = handleMarkEdit(studentIndex, markType, editingValue);
      if (isValid) {
        setEditingCell(null);
        setEditingValue("");
      }
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setEditingValue("");
    }
  };

  const handleEditStart = (studentIndex: number, markType: keyof StudentMarks, currentValue: number | null) => {
    setEditingCell({ studentIndex, markType });
    setEditingValue(currentValue !== null ? currentValue.toString() : "");
  };

  const renderCell = (student: Student, index: number, markType: keyof StudentMarks) => {
    const isEditing = editingCell?.studentIndex === index && editingCell?.markType === markType;
    const value = student.marks[markType];

    if (isEditing) {
      return (
        <Input
          autoFocus
          value={editingValue}
          onChange={(e, data) => setEditingValue(data.value)}
          style={{ width: "60px" }}
          onKeyDown={(e) => handleKeyPress(e, index, markType)}
          onBlur={() => {
            const isValid = handleMarkEdit(index, markType, editingValue);
            if (isValid) {
              setEditingCell(null);
              setEditingValue("");
            }
          }}
        />
      );
    }

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => handleEditStart(index, markType, value)}
      >
        <span>{formatMark(value)}</span>
        <Edit24Regular
          style={{
            visibility: "hidden",
            marginRight: "4px",
            color: "#0078D4",
            fontSize: "14px",
          }}
        />
      </div>
    );
  };

  return (
    <div className="data-preview">
      <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
        <CheckmarkCircle24Regular style={{ marginLeft: "12px", color: "#0078D4" }} />
        <Text as="h3" size={500} weight="semibold">
          مراجعة البيانات المستخرجة
        </Text>
      </div>

      <Text size={300} style={{ marginBottom: "16px", color: "#666" }}>
        يمكنك تصحيح أي علامة غير صحيحة بالنقر عليها
      </Text>

      <div className="table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
        <Table style={{ tableLayout: "fixed", width: "100%" }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: "60px", minWidth: "60px", maxWidth: "60px", whiteSpace: "nowrap" }}>
                رقم التلميذ
              </TableHeaderCell>
              <TableHeaderCell>الاسم</TableHeaderCell>
              <TableHeaderCell>الفرض 1</TableHeaderCell>
              <TableHeaderCell>الفرض 2</TableHeaderCell>
              <TableHeaderCell>الفرض 3</TableHeaderCell>
              <TableHeaderCell>الأنشطة</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editableData.map((student, index) => (
              <TableRow
                key={`student-${student.number}-${index}`}
                style={{
                  backgroundColor: index % 2 === 0 ? "#f9f9f9" : "white",
                }}
              >
                <TableCell style={{ width: "60px", minWidth: "60px", maxWidth: "60px", whiteSpace: "nowrap" }}>
                  {student.number}
                </TableCell>
                <TableCell>{student.name}</TableCell>
                <TableCell>{renderCell(student, index, "fard1")}</TableCell>
                <TableCell>{renderCell(student, index, "fard2")}</TableCell>
                <TableCell>{renderCell(student, index, "fard3")}</TableCell>
                <TableCell>{renderCell(student, index, "activities")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ButtonContainer>
        <PrimaryButton appearance="primary" onClick={() => onConfirm(editableData)}>
          تأكيد وإدخال في Excel
        </PrimaryButton>
        <SecondaryButton appearance="secondary" onClick={onCancel}>
          إلغاء
        </SecondaryButton>
      </ButtonContainer>
    </div>
  );
};

export default DataPreview;

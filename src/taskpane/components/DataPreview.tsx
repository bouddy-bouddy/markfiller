import React, { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Button,
  Input,
  Text,
} from "@fluentui/react-components";
import { Edit24Regular, CheckmarkCircle24Regular } from "@fluentui/react-icons";
import { Student, StudentMarks } from "../types";

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

  const validateMark = (value: string | number | null): boolean => {
    if (value === "" || value === null) return true;
    const num = typeof value === "string" ? parseFloat(value) : value;
    return !isNaN(num) && num >= 0 && num <= 20;
  };

  const formatMark = (value: number | null): string => {
    if (value === null) return "";
    return parseFloat(value.toString()).toFixed(2);
  };

  const handleMarkEdit = (studentIndex: number, markType: keyof StudentMarks, value: string): boolean => {
    const newValue = value.trim() === "" ? null : parseFloat(value);

    if (newValue !== null && !validateMark(newValue)) {
      return false;
    }

    const newData = [...editableData];
    newData[studentIndex] = {
      ...newData[studentIndex],
      marks: {
        ...newData[studentIndex].marks,
        [markType]: newValue === null ? null : (parseFloat(newValue.toString()).toFixed(2) as unknown as number),
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
  ): void => {
    if (e.key === "Enter") {
      const isValid = handleMarkEdit(studentIndex, markType, e.currentTarget.value);
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

    if (isEditing) {
      return (
        <Input
          autoFocus
          defaultValue={value !== null ? value.toString() : ""}
          style={{ width: "60px" }}
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setEditingCell({ studentIndex: index, markType })}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>رقم</TableHeaderCell>
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
                <TableCell>{student.number}</TableCell>
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

      <div
        className="button-container"
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
        }}
      >
        <Button appearance="primary" onClick={() => onConfirm(editableData)}>
          تأكيد وإدخال في Excel
        </Button>
        <Button appearance="secondary" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  );
};

export default DataPreview;

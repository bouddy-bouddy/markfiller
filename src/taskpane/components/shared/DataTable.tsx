import React, { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Input,
  Text,
  Tooltip,
} from "@fluentui/react-components";
import { Edit24Regular, Warning16Regular } from "@fluentui/react-icons";
import { Student, StudentMarks } from "../../types";

interface DataTableProps {
  data: Student[];
  onDataUpdate: (newData: Student[]) => void;
  suspiciousMarks?: Student[];
}

interface EditingCell {
  studentIndex: number;
  markType: keyof StudentMarks;
}

const DataTable: React.FC<DataTableProps> = ({ data, onDataUpdate, suspiciousMarks = [] }) => {
  const [editableData, setEditableData] = useState<Student[]>(data);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  // Map of suspicious students by ID for quick lookup
  const [suspiciousMap, setSuspiciousMap] = useState<Record<string, Set<keyof StudentMarks>>>({});

  // Update suspiciousMap when suspiciousMarks changes
  useEffect(() => {
    const newMap: Record<string, Set<keyof StudentMarks>> = {};

    suspiciousMarks.forEach((student) => {
      const key = `${student.number}-${student.name}`;
      newMap[key] = new Set();

      // Check which marks are suspicious (this is simplified; normally would come from validation)
      if (student.marks.fard1 !== null && (student.marks.fard1 < 3 || student.marks.fard1 > 18)) {
        newMap[key].add("fard1");
      }
      if (student.marks.fard2 !== null && (student.marks.fard2 < 3 || student.marks.fard2 > 18)) {
        newMap[key].add("fard2");
      }
      if (student.marks.fard3 !== null && (student.marks.fard3 < 3 || student.marks.fard3 > 18)) {
        newMap[key].add("fard3");
      }
      if (student.marks.activities !== null && (student.marks.activities < 5 || student.marks.activities > 19)) {
        newMap[key].add("activities");
      }
    });

    setSuspiciousMap(newMap);
  }, [suspiciousMarks]);

  // Update editableData when data changes
  useEffect(() => {
    setEditableData(data);
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

  const isMarkSuspicious = (student: Student, markType: keyof StudentMarks): boolean => {
    const key = `${student.number}-${student.name}`;
    return suspiciousMap[key]?.has(markType) || false;
  };

  const renderCell = (student: Student, index: number, markType: keyof StudentMarks) => {
    const isEditing = editingCell?.studentIndex === index && editingCell?.markType === markType;
    const value = student.marks[markType];
    const isSuspicious = isMarkSuspicious(student, markType);

    if (isEditing) {
      return (
        <Input
          autoFocus
          defaultValue={value !== null ? value.toString() : ""}
          style={{
            width: "60px",
            backgroundColor: isSuspicious ? "#fff5f5" : undefined,
          }}
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
          backgroundColor: isSuspicious ? "#fff5f5" : undefined,
          padding: "4px",
          borderRadius: "4px",
        }}
        onClick={() => setEditingCell({ studentIndex: index, markType })}
      >
        <span>{formatMark(value)}</span>
        <div style={{ display: "flex", alignItems: "center" }}>
          {isSuspicious && (
            <Tooltip content="علامة غير معتادة. تحقق منها." relationship="label">
              <Warning16Regular
                style={{
                  marginRight: "4px",
                  color: "#e53e3e",
                  fontSize: "14px",
                }}
              />
            </Tooltip>
          )}
          <Edit24Regular
            style={{
              visibility: "hidden",
              marginRight: "4px",
              color: "#0078D4",
              fontSize: "14px",
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className="table-container"
      style={{ maxHeight: "400px", overflowY: "auto", borderRadius: "4px", border: "1px solid #e0e0e0" }}
    >
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
  );
};

export default DataTable;

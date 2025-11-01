import styled from "styled-components";
import { Card, Text, Button, Table, TableRow, TableCell, Badge } from "@fluentui/react-components";

/**
 * Styled components for MappingPreview
 * Extracted to separate file to prevent recreation on every render
 */

export const MappingContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 20px;
`;

export const SummaryCard = styled(Card)`
  padding: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

export const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

export const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

export const SummaryNumber = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: #0e7c42;
  margin-bottom: 4px;
`;

export const SummaryLabel = styled(Text)`
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
`;

export const MappingTable = styled(Table)`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

export const StudentRow = styled(TableRow)<{ found: boolean }>`
  background: ${(props) => (props.found ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)")};

  &:hover {
    background: ${(props) => (props.found ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)")};
  }
`;

export const MarkCell = styled(TableCell)<{ willInsert: boolean }>`
  text-align: center;
  font-weight: ${(props) => (props.willInsert ? "600" : "400")};
  color: ${(props) => (props.willInsert ? "#0e7c42" : "#94a3b8")};
`;

export const StatusBadge = styled(Badge)<{ status: "success" | "error" | "warning" }>`
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

export const ActionButtons = styled.div`
  display: flex;
  gap: 16px;
  justify-content: flex-start;
  margin-top: 20px;
`;

export const PrimaryButton = styled(Button)`
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

export const SecondaryButton = styled(Button)`
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

export const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  text-align: center;
`;

export const PaginationContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-top: 1px solid rgba(14, 124, 66, 0.1);
  background: #f8fafc;
`;

export const PaginationInfo = styled(Text)`
  color: #64748b;
  font-size: 14px;
`;

export const PaginationButtons = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;


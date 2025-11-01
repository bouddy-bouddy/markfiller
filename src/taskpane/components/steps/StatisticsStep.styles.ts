import styled from "styled-components";
import { Card, Button, Badge, Text } from "@fluentui/react-components";

export const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
`;

export const StepContent = styled.div`
  width: 100%;
  max-width: 100%;
  padding: 0;
`;

export const DashboardContainer = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 20px;
  padding: 24px !important;
  margin-bottom: 20px;
  direction: rtl;
`;

export const MetaBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #ffffff;
  border: 1px dashed rgba(14, 124, 66, 0.35);
  border-radius: 10px;
`;

export const MetaItem = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  color: #0f172a;
`;

export const MetaLabel = styled.span`
  color: #64748b;
`;

export const StatsHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  padding: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  border: 1px solid rgba(14, 124, 66, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  page-break-inside: avoid;
`;

export const MainTitle = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #0e7c42;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: visible;
  text-align: right;
  line-height: 1.2;
`;

export const Subtitle = styled.div`
  font-size: 16px;
  color: #64748b;
  margin-bottom: 16px;
`;

export const GeneratedDate = styled.div`
  font-size: 14px;
  color: #94a3b8;
  font-style: italic;
`;

export const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
  page-break-inside: avoid;
`;

export const KPICard = styled(Card)`
  padding: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(14, 124, 66, 0.15);
    border-color: rgba(14, 124, 66, 0.2);
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
  }
`;

export const KPIValue = styled.div`
  font-size: 36px;
  font-weight: 700;
  color: #0e7c42;
  margin: 12px 0 8px 0;
  line-height: 1;
`;

export const KPILabel = styled.div`
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const KPIIcon = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  opacity: 0.1;
  font-size: 48px;
  color: #0e7c42;
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 32px 0 20px 0;
  padding: 16px 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 12px;
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

export const SectionTitle = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
`;

export const SectionIcon = styled.div`
  color: #0e7c42;
`;

export const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
  page-break-inside: avoid;
`;

export const ChartCard = styled(Card)`
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(14, 124, 66, 0.1);
  }
`;

export const ChartTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
  text-align: center;
`;

export const PerformanceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
  page-break-inside: avoid;
`;

export const PerformanceCard = styled(Card)`
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

export const PerformanceTable = styled.div`
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

export const TableHeader = styled.div`
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
  color: white;
  padding: 16px;
  font-weight: 600;
  text-align: center;
`;

export const TableRow = styled.div`
  display: grid;
  grid-template-columns: 40px 1fr 80px 80px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(14, 124, 66, 0.1);
  align-items: center;
  gap: 12px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(14, 124, 66, 0.02);
  }

  &:last-child {
    border-bottom: none;
  }
`;

export const RankBadge = styled.div<{ rank: number }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  background: ${(props) =>
    props.rank === 1
      ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
      : props.rank === 2
        ? "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)"
        : props.rank === 3
          ? "linear-gradient(135deg, #cd7c0f 0%, #92400e 100%)"
          : "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)"};
  color: ${(props) => (props.rank <= 3 ? "white" : "#64748b")};
`;

export const StudentName = styled.div`
  font-weight: 500;
  color: #1e293b;
`;

export const ScoreBadge = styled(Badge)<{ score: number }>`
  background: ${(props) =>
    props.score >= 16
      ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
      : props.score >= 14
        ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
        : props.score >= 10
          ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"} !important;
  color: white !important;
  font-weight: 600 !important;
`;

export const DistributionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
  page-break-inside: avoid;
`;

export const DistributionCard = styled(Card)`
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(14, 124, 66, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

export const DistributionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(14, 124, 66, 0.1);
`;

export const DistributionTitle = styled.div<{ color: string }>`
  font-size: 18px;
  font-weight: 700;
  color: ${(props) => props.color};
`;

export const DistributionItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(14, 124, 66, 0.02);
  border-radius: 8px;
  border-left: 4px solid #0e7c42;
`;

export const DistributionRange = styled.div`
  font-weight: 600;
  color: #1e293b;
`;

export const DistributionCount = styled.div`
  font-weight: 700;
  color: #0e7c42;
`;

export const DistributionBar = styled.div`
  height: 8px;
  background: rgba(14, 124, 66, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
`;

export const DistributionFill = styled.div<{ width: string; color: string }>`
  height: 100%;
  background: ${(props) => props.color};
  width: ${(props) => props.width};
  transition: width 0.6s ease;
  border-radius: 4px;
`;

export const RecommendationsList = styled.ul`
  margin: 0;
  padding: 0 24px;
  list-style: none;
`;

export const RecommendationItem = styled.li`
  margin-bottom: 16px;
  padding: 16px;
  background: rgba(14, 124, 66, 0.05);
  border-radius: 8px;
  border-left: 4px solid #0e7c42;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

export const RecommendationIcon = styled.div`
  color: #0e7c42;
  margin-top: 2px;
  flex-shrink: 0;
`;

export const RecommendationText = styled(Text)`
  line-height: 1.6 !important;
`;

export const RecommendationsCard = styled(PerformanceCard)`
  margin-bottom: 32px;
`;

export const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  margin: 40px 0;
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  border: 1px solid rgba(14, 124, 66, 0.1);
`;

export const PrimaryActionButton = styled(Button)`
  border-radius: 16px !important;
  font-weight: 700 !important;
  padding: 16px 32px !important;
  background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
  border: none !important;
  box-shadow: 0 8px 24px rgba(14, 124, 66, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  font-size: 16px !important;
  min-width: 200px !important;

  &:hover:not(:disabled) {
    transform: translateY(-4px) !important;
    box-shadow: 0 16px 32px rgba(14, 124, 66, 0.4) !important;
  }

  &:active:not(:disabled) {
    transform: translateY(-2px) !important;
  }

  .fui-Button__icon {
    margin-left: 8px !important;
    font-size: 20px !important;
  }
`;

export const SecondaryActionButton = styled(Button)`
  border-radius: 16px !important;
  font-weight: 600 !important;
  padding: 16px 32px !important;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
  border: 2px solid #0e7c42 !important;
  color: #0e7c42 !important;
  box-shadow: 0 4px 12px rgba(14, 124, 66, 0.1) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  font-size: 16px !important;
  min-width: 200px !important;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%) !important;
    color: white !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 20px rgba(14, 124, 66, 0.2) !important;
  }

  .fui-Button__icon {
    margin-left: 8px !important;
    font-size: 20px !important;
  }
`;

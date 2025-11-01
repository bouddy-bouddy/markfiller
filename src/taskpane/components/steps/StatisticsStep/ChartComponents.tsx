/* global HTMLCanvasElement */
import React, { memo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import * as S from "../StatisticsStep.styles";

/**
 * Optimized Chart Components with React.memo
 * These components only re-render when their data changes
 */

interface AveragesBarChartProps {
  data: ChartData<"bar">;
}

export const AveragesBarChart = memo<AveragesBarChartProps>(({ data }) => {
  return (
    <S.ChartCard>
      <S.ChartTitle>متوسط العلامات حسب النوع</S.ChartTitle>
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(14, 124, 66, 0.9)",
              titleColor: "#ffffff",
              bodyColor: "#ffffff",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 20,
              grid: { color: "rgba(14, 124, 66, 0.1)" },
            },
            x: {
              grid: { display: false },
            },
          },
        }}
      />
    </S.ChartCard>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for deep equality on chart data
  return (
    JSON.stringify(prevProps.data.labels) === JSON.stringify(nextProps.data.labels) &&
    JSON.stringify(prevProps.data.datasets) === JSON.stringify(nextProps.data.datasets)
  );
});

AveragesBarChart.displayName = "AveragesBarChart";

interface PassFailDoughnutChartProps {
  data: ChartData<"doughnut">;
}

export const PassFailDoughnutChart = memo<PassFailDoughnutChartProps>(({ data }) => {
  return (
    <S.ChartCard>
      <S.ChartTitle>توزيع النجاح والرسوب</S.ChartTitle>
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: "bottom" as const,
              labels: {
                padding: 20,
                usePointStyle: true,
                generateLabels: function (chart) {
                  const chartData = chart.data;
                  if (chartData.labels && chartData.datasets.length > 0) {
                    return chartData.labels.map((label, i) => {
                      const value = chartData.datasets[0].data[i] as number;
                      const backgroundColor = chartData.datasets[0].backgroundColor as string[];
                      return {
                        text: `${label}: ${value}%`,
                        fillStyle: backgroundColor[i],
                        strokeStyle: backgroundColor[i],
                        lineWidth: 0,
                        pointStyle: "circle",
                        hidden: false,
                        index: i,
                      };
                    });
                  }
                  return [];
                },
              },
            },
            tooltip: {
              backgroundColor: "rgba(14, 124, 66, 0.9)",
              titleColor: "#ffffff",
              bodyColor: "#ffffff",
              callbacks: {
                label: function (context) {
                  return `${context.label}: ${context.parsed}%`;
                },
              },
            },
          },
        }}
      />
    </S.ChartCard>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for deep equality on chart data
  return (
    JSON.stringify(prevProps.data.labels) === JSON.stringify(nextProps.data.labels) &&
    JSON.stringify(prevProps.data.datasets) === JSON.stringify(nextProps.data.datasets)
  );
});

PassFailDoughnutChart.displayName = "PassFailDoughnutChart";


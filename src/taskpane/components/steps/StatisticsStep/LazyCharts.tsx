import React, { lazy, Suspense, useEffect, useState } from "react";
import { Spinner } from "@fluentui/react-components";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from "chart.js";
import type { ChartData } from "chart.js";
import { ChartMultiple24Regular } from "@fluentui/react-icons";
import * as S from "../StatisticsStep.styles";

/**
 * Lazy load Chart.js components only when needed
 * Dramatically reduces initial bundle size and load time
 */

// Register Chart.js components once when this module loads
let isChartJsRegistered = false;

const registerChartJS = () => {
  if (!isChartJsRegistered) {
    ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);
    isChartJsRegistered = true;
  }
};

// Lazy load individual chart components
const AveragesBarChartLazy = lazy(async () => {
  registerChartJS();
  const module = await import("./ChartComponents");
  return { default: module.AveragesBarChart };
});

const PassFailDoughnutChartLazy = lazy(async () => {
  registerChartJS();
  const module = await import("./ChartComponents");
  return { default: module.PassFailDoughnutChart };
});

interface LazyChartsProps {
  averagesBarData: ChartData<"bar">;
  passFailDoughnutData: ChartData<"doughnut">;
}

export const LazyCharts: React.FC<LazyChartsProps> = ({ averagesBarData, passFailDoughnutData }) => {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Delay chart loading slightly to prioritize initial render
    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!shouldLoad) {
    return (
      <S.ChartsGrid>
        <S.ChartCard>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
            <Spinner size="large" label="جاري تحميل الرسوم البيانية..." />
          </div>
        </S.ChartCard>
      </S.ChartsGrid>
    );
  }

  return (
    <>
      <S.SectionHeader>
        <S.SectionIcon>
          <ChartMultiple24Regular />
        </S.SectionIcon>
        <S.SectionTitle>الرسوم البيانية والتوزيعات</S.SectionTitle>
      </S.SectionHeader>

      <Suspense
        fallback={
          <S.ChartsGrid>
            <S.ChartCard>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
                <Spinner size="large" label="جاري تحميل الرسوم البيانية..." />
              </div>
            </S.ChartCard>
          </S.ChartsGrid>
        }
      >
        <S.ChartsGrid>
          <AveragesBarChartLazy data={averagesBarData} />
          <PassFailDoughnutChartLazy data={passFailDoughnutData} />
        </S.ChartsGrid>
      </Suspense>
    </>
  );
};


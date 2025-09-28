import { createGlobalStyle } from "styled-components";

// GlobalStyle for App
export const GlobalStyle = createGlobalStyle`
  /* Base RTL Settings */
  html, body {
    direction: rtl;
    text-align: right;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
    font-feature-settings: 'ss01', 'ss02', 'cv01', 'cv02';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    height: 100%;
  }

  body {
    padding: 0;
    height: auto;
    min-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
  }

  /* Ensure the Office container fills the available height */
  #container {
    height: 100%;
  }

  /* Container styles */
  .app-container {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 16px;
    box-shadow: 
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04),
      0 0 0 1px rgba(0, 0, 0, 0.05);
    direction: rtl;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .app-content {
    padding: 0 16px 16px 16px;
    flex: 1;
    overflow-y: auto;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.6) 100%);
  }
  
  /* Step styling */
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 32px;
    margin-top: 24px;
    padding-bottom: 24px;
  }

  .step {
    border: 1px solid rgba(14, 124, 66, 0.1);
    border-radius: 16px;
    padding: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: right;
    direction: rtl;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    position: relative;
    overflow: hidden;
  }

  .step::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .step.active {
    border-color: rgba(14, 124, 66, 0.3);
    box-shadow: 
      0 20px 25px -5px rgba(14, 124, 66, 0.1),
      0 10px 10px -5px rgba(14, 124, 66, 0.04),
      0 0 0 1px rgba(14, 124, 66, 0.1);
    transform: translateY(-2px);
  }

  .step.active::before {
    opacity: 1;
  }

  .step.completed {
    border-color: rgba(14, 124, 66, 0.2);
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  }
  
  .step-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  
  .step-content {
    padding-left: 16px;
  }

  /* Force RTL for all elements with text */
  input, button, select, textarea, div, span, p, h1, h2, h3, h4, h5, h6 {
    text-align: right;
  }

  /* Override Fluent UI RTL */
  .fui-FluentProvider {
    direction: rtl;
  }
  
  /* Progress bar container */
  .progress-container {
    margin-bottom: 32px;
    padding: 0 32px;
  }
  
  /* Progress pills */
  .progress-pills {
    display: flex;
    justify-content: space-between;
    position: relative;
    margin: 32px 0;
    padding: 16px 0;
  }
  
  /* Line connecting pills */
  .progress-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 100%);
    transform: translateY(-50%);
    z-index: 1;
    border-radius: 2px;
  }
  
  .progress-line-filled {
    position: absolute;
    top: 50%;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, #0e7c42 0%, #10b981 100%);
    transform: translateY(-50%);
    z-index: 2;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(14, 124, 66, 0.3);
  }
  
  /* Individual pill */
  .progress-pill {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #64748b;
    position: relative;
    z-index: 3;
    border: 3px solid #e2e8f0;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .progress-pill:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  
  .progress-pill.active {
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    border-color: #0e7c42;
    box-shadow: 
      0 0 0 4px rgba(14, 124, 66, 0.1),
      0 10px 15px -3px rgba(14, 124, 66, 0.2),
      0 4px 6px -2px rgba(14, 124, 66, 0.1);
    transform: scale(1.1);
  }
  
  .progress-pill.completed {
    background: linear-gradient(135deg, #0e7c42 0%, #10b981 100%);
    color: white;
    border-color: #0e7c42;
    box-shadow: 
      0 0 0 4px rgba(14, 124, 66, 0.1),
      0 10px 15px -3px rgba(14, 124, 66, 0.2),
      0 4px 6px -2px rgba(14, 124, 66, 0.1);
  }
  
  /* Pill label */
  .pill-label {
    position: absolute;
    top: 48px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 13px;
    color: #64748b;
    font-weight: 600;
    transition: all 0.3s ease;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  }
  
  .pill-label.active, .pill-label.completed {
    color: #0e7c42;
    font-weight: 700;
    text-shadow: none;
  }

  /* Enhanced button styles */
  .fui-Button {
    border-radius: 12px !important;
    font-weight: 600 !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
  }

  .fui-Button:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
  }

  .fui-Button:active {
    transform: translateY(0) !important;
  }

  /* Enhanced card styles */
  .fui-Card {
    border-radius: 16px !important;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  .fui-Card:hover {
    transform: translateY(-2px) !important;
    box-shadow: 
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
  }

  /* Enhanced text styles */
  .fui-Text {
    line-height: 1.6 !important;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #0e7c42 0%, #10b981 100%);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #065f46 0%, #0e7c42 100%);
  }

  /* Animation keyframes */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: calc(200px + 100%) 0;
    }
  }

  /* Apply animations to steps */
  .step {
    animation: fadeInUp 0.6s ease-out;
  }

  .step:nth-child(1) { animation-delay: 0.1s; }
  .step:nth-child(2) { animation-delay: 0.2s; }
  .step:nth-child(3) { animation-delay: 0.3s; }
  .step:nth-child(4) { animation-delay: 0.4s; }

  /* Enhanced focus states */
  .fui-Button:focus-visible,
  .fui-Card:focus-visible,
  .progress-pill:focus-visible {
    outline: 2px solid #0e7c42 !important;
    outline-offset: 2px !important;
  }

  /* Simple, modern Developer Footer */
  .developer-footer {
    background: #0f172a;
    color: #e2e8f0;
    padding: 20px 16px;
    margin-top: 24px;
    text-align: center;
    border: 1px solid rgba(148, 163, 184, 0.18);
    box-shadow: 0 6px 16px rgba(2, 6, 23, 0.25);

    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
  }

  .developer-name {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 6px;
    color: #16a34a;
  }

  .copyright-text {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

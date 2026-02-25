// report-status.js — ES module
// Индикатор загрузки отчета

import Modals from './modals.js';

const MODAL_ID = 'reportLoadingModal';
const SUCCESS_DELAY = 2000;
const ERROR_DELAY = 5000;

  function getModal() {
    return document.getElementById(MODAL_ID);
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function showReportLoading() {
    const modal = getModal();
    if (!modal) return;

    const spinner = getElement('loadingSpinner');
    const success = getElement('loadingSuccess');
    const error = getElement('loadingError');
    const text = getElement('loadingText');
    const errorMessage = getElement('loadingErrorMessage');

    // Сброс состояния
    if (spinner) spinner.style.display = 'block';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (text) text.textContent = 'Загрузка...';
    if (errorMessage) {
      errorMessage.style.display = 'none';
      errorMessage.textContent = '';
    }

    Modals.showModal(MODAL_ID);
  }

  function showReportSuccess() {
    const modal = getModal();
    if (!modal) return;

    const spinner = getElement('loadingSpinner');
    const success = getElement('loadingSuccess');
    const text = getElement('loadingText');

    if (spinner) spinner.style.display = 'none';
    if (success) success.style.display = 'flex';
    if (text) text.textContent = 'Отчет успешно сформирован!';

    setTimeout(() => {
      Modals.hideModal(MODAL_ID);
    }, SUCCESS_DELAY);
  }

  function showReportError(message) {
    const modal = getModal();
    if (!modal) return;

    const spinner = getElement('loadingSpinner');
    const error = getElement('loadingError');
    const text = getElement('loadingText');
    const errorMessage = getElement('loadingErrorMessage');

    if (spinner) spinner.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (text) text.textContent = 'Ошибка при генерации отчета';
    if (errorMessage) {
      errorMessage.textContent = message || 'Произошла неизвестная ошибка';
      errorMessage.style.display = 'block';
    }

    setTimeout(() => {
      Modals.hideModal(MODAL_ID);
    }, ERROR_DELAY);
  }

  const ReportStatus = {
    showReportLoading,
    showReportSuccess,
    showReportError
  };

  if (typeof window !== 'undefined') {
    window.ReportStatus = ReportStatus;
    window.showReportLoading = showReportLoading;
    window.showReportSuccess = showReportSuccess;
    window.showReportError = showReportError;
  }

  export default ReportStatus;
  export { showReportLoading, showReportSuccess, showReportError };

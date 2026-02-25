/**
 * Загрузчик конфигурации API (шаг 10.1).
 * Опционально подключает api-config.local.js при наличии, затем — api-config.js.
 * Локальный конфиг задаёт window.API_BASE_URL, window.USE_API и др. до инициализации ApiConfig.
 */
try {
  await import('./api-config.local.js');
} catch (_) {
  // Файл отсутствует — используются значения по умолчанию из api-config.js
}
await import('./api-config.js');
export {};

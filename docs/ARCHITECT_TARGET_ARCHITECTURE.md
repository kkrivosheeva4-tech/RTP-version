# Документ для архитекторов: целевая архитектура веб-сервиса «Радар технологий РМКД»

**Статус:** проектный документ для архитектурной проработки
**Дата:** 27.03.2026
**Назначение:** описание проектируемой системы для архитектурной заявки
**Основание:** [Техническое задание v2](c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/docs/Техническое%20задание%20v2.txt), [Документация для заявки на архитектуру Радара Технологий.txt](c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/docs/Документация%20для%20заявки%20на%20архитектуру%20Радара%20Технологий.txt)

## 1. Назначение документа

Документ предназначен для архитектурной команды и руководителей проекта и описывает целевую архитектуру веб-сервиса «Радар технологий РМКД» как проектируемой корпоративной информационно-аналитической системы.

Документ отвечает на вопросы архитектора по следующим направлениям:

- ФТТ и основание для разработки;
- функциональные, нефункциональные и бизнес-требования;
- требуемые интеграции и потоки данных;
- техническая информация о работе системы;
- системные требования и целевой стек;
- sizing и вычислительные мощности;
- количество и категории пользователей тестовой системы;
- перспективы развития и масштабирования;
- модель доступа пользователей, разработчиков и администраторов.

### 1.1 Уточнение границ MVP (07.04.2026)

Для `MVP` в рамках ответственности команды разработки из прикладного контура исключается app-level блок `backup/restore` (UI/API и локальное backup storage приложения).
Резервирование, хранение и восстановление выполняются во внешнем эксплуатационном контуре по регламенту `СРК` (Confluence), владельцем процесса является инфраструктурная команда.

## 2. Основание для разработки и бизнес-контекст

### 2.1 Основание для разработки

Разработка системы обусловлена необходимостью автоматизации процесса сбора, консолидации, анализа и визуализации сведений о цифровых технологиях, применяемых или рассматриваемых к применению в компаниях холдинга.

До внедрения системы процесс ведется разрозненно, что приводит к следующим ограничениям:

- отсутствует единый источник достоверных данных;
- затруднено сопоставление технологий по предприятиям, функциям и направлениям;
- затруднен анализ цифровой зрелости и технологического покрытия;
- отсутствует единая управляемая среда совместной работы;
- повышены трудозатраты на предпроектную проработку и формирование отчетности.

### 2.2 Цель проекта

Цель проекта заключается в создании веб-сервиса, обеспечивающего:

- централизованный сбор и хранение информации о технологиях;
- структурирование данных по предприятиям, функциональным блокам, функциям и направлениям;
- визуализацию технологического радара;
- анализ зрелости технологий и готовности предприятий к внедрению;
- поддержку управленческих и архитектурных решений;
- повышение прозрачности и сокращение времени предпроектной оценки инициатив.

### 2.3 Назначение системы

Система проектируется как единая информационно-аналитическая платформа для:

- архитекторов;
- руководителей проектов;
- экспертов по цифровым технологиям;
- управленческих подразделений;
- технических администраторов;
- в перспективе внешнего выделенного vendor-контура.

## 3. ФТТ и ТЗ

### 3.1 Ключевые функционально-технические требования

На основании ТЗ и материалов архитектурной заявки система должна включать следующие функциональные блоки:

- визуализация технологического радара по квадрантам и уровням зрелости;
- каталог технологий с карточками, поиском, фильтрацией и CRUD-операциями;
- ведение справочников предприятий, функциональных блоков, функций, направлений, вендоров и интеграторов;
- управление доступом пользователей и ролями;
- двухфакторная аутентификация;
- аудит действий пользователей;
- формирование отчетов и экспорт данных;
- резервирование и восстановление по регламенту `СРК` (вне app-level MVP);
- предоставление структурированной справочной информации по системе.

### 3.2 Объекты автоматизации

Объектами автоматизации являются:

- предприятия холдинга;
- технологии и связанные с ними функциональные блоки и функции;
- информационные потоки по вводу, актуализации, хранению и анализу данных;
- пользователи системы и их роли;
- процессы модерации, аудита и подготовки отчетности.

### 3.3 Ключевые пользовательские сценарии

Проектируемая система должна обеспечивать следующие базовые сценарии:

1. Пользователь проходит аутентификацию и при необходимости двухфакторную проверку.
2. При первичном входе пользователь в обязательном порядке меняет временный пароль на постоянный.
3. Пользователь открывает технологический радар и применяет фильтры.
4. Пользователь просматривает карточки технологий и связанные сведения.
5. Пользователь с соответствующими правами создает, редактирует или удаляет технологии.
6. Пользователь формирует экспорт и отчетные материалы.
7. Администратор управляет пользователями и аудитом; резервирование выполняется по регламенту `СРК`.

## 4. Бизнес-, функциональные и нефункциональные требования

### 4.1 Бизнес-требования

- создание единого источника данных о технологическом развитии;
- повышение обоснованности управленческих и архитектурных решений;
- сокращение времени оценки и приоритизации инициатив;
- повышение прозрачности уровня цифровой зрелости функций и предприятий;
- выявление технологических разрывов и зон развития;
- создание управляемого пространства совместной работы с разграничением ролей и ответственности.

### 4.2 Функциональные требования

В проектируемой системе должны быть реализованы:

- аутентификация и авторизация пользователей;
- обязательная смена временного пароля при первом входе пользователя;
- двухфакторная аутентификация `TOTP`;
- визуализация технологического радара;
- поиск, фильтрация и детализация технологий;
- ведение каталога технологий;
- хранение статуса внедрения и оценок готовности предприятий;
- ведение справочников;
- экспорт отчетов в машиночитаемые и пользовательские форматы;
- аудит значимых действий;
- справочный раздел;
- административные функции управления пользователями и аудитом.

### 4.3 Нефункциональные требования

- система должна работать в корпоративном Linux-контуре;
- взаимодействие между web-клиентом и сервером должно осуществляться через `REST API`;
- права доступа и прикладная логика должны контролироваться на backend;
- бизнес-данные должны храниться централизованно в серверной БД;
- доступ к системе должен осуществляться по `HTTPS`;
- система должна иметь журналирование ошибок и событий;
- должна быть обеспечена возможность резервного копирования и контролируемого восстановления во внешнем контуре по регламенту `СРК`;
- должны поддерживаться мониторинг, smoke-проверки и эксплуатационная документация;
- архитектура должна допускать развитие и масштабирование без пересмотра базовой модели системы.

### 4.4 Требования к интерфейсу

- единый корпоративный web-интерфейс;
- адаптивное отображение для стандартных пользовательских рабочих мест;
- понятная навигация, поиск и фильтрация;
- формы ввода и редактирования данных;
- визуализация радара и детального просмотра технологий;
- справка, подсказки и обратная связь на действия пользователя.

## 5. Целевая архитектура системы

### 5.1 Архитектурный принцип

Система проектируется как трехзвенное web-решение:

- web-слой;
- прикладной слой;
- слой данных.

Базовый архитектурный принцип:

- пользователь работает через web-интерфейс;
- web-интерфейс взаимодействует с backend через единый API;
- backend реализует бизнес-логику, авторизацию, модерацию, аудит и административные функции;
- данные хранятся централизованно в `PostgreSQL`.

### 5.2 Архитектурные компоненты

#### Web-слой

- браузер пользователя;
- reverse proxy / web server `nginx`;
- публикация интерфейса по `HTTPS`.

#### Прикладной слой

- сервер приложений `Gunicorn`;
- backend на `Django`;
- API-слой;
- модуль аутентификации и 2FA;
- модуль управления технологиями;
- модуль справочников;
- модуль аудита;
- модуль метрик и health-check.

#### Слой данных

- `PostgreSQL 14+`;
- хранение данных о технологиях, предприятиях, функциях, направлениях, пользователях и журнале аудита;
- хранение служебных данных по сессиям и ролям.

### 5.3 Логическая схема взаимодействия систем

#### Рисунок 2. Общая архитектурная схема системы (`draw.io / mxGraphModel`)

```xml
<mxfile host="app.diagrams.net" modified="2026-03-27T12:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="architecture-figure-2" name="Architecture">
    <mxGraphModel dx="1700" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="actors" value="Пользователи&#xa;guest / editor / owner / admin" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=14;" vertex="1" parent="1"><mxGeometry x="30" y="240" width="190" height="80" as="geometry"/></mxCell>
        <mxCell id="web-layer" value="Web layer" style="swimlane;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="280" y="70" width="260" height="430" as="geometry"/></mxCell>
        <mxCell id="nginx-main" value="Nginx reverse proxy&#xa;HTTPS / TLS&#xa;routing to UI and API" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="web-layer"><mxGeometry x="25" y="50" width="200" height="90" as="geometry"/></mxCell>
        <mxCell id="ui-pages" value="Web pages&#xa;/&#xa;/radar/&#xa;/help/&#xa;/admin-panel/" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="web-layer"><mxGeometry x="25" y="180" width="120" height="120" as="geometry"/></mxCell>
        <mxCell id="auth-pages" value="Auth pages&#xa;/auth/login/&#xa;/auth/2fa/setup/&#xa;/auth/2fa/verify/" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="web-layer"><mxGeometry x="155" y="180" width="90" height="120" as="geometry"/></mxCell>
        <mxCell id="app-layer" value="Application layer" style="swimlane;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="610" y="40" width="470" height="520" as="geometry"/></mxCell>
        <mxCell id="gun" value="Gunicorn" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="app-layer"><mxGeometry x="20" y="40" width="120" height="50" as="geometry"/></mxCell>
        <mxCell id="djui" value="Django UI delivery&#xa;templates / static" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="app-layer"><mxGeometry x="170" y="35" width="150" height="60" as="geometry"/></mxCell>
        <mxCell id="api-gateway" value="REST API gateway&#xa;/api/v1/*" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="app-layer"><mxGeometry x="350" y="35" width="100" height="60" as="geometry"/></mxCell>
        <mxCell id="auth-box" value="Auth / Roles / 2FA&#xa;login&#xa;refresh&#xa;logout&#xa;users/me" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="app-layer"><mxGeometry x="20" y="140" width="130" height="120" as="geometry"/></mxCell>
        <mxCell id="ref-box" value="References&#xa;enterprises&#xa;blocks&#xa;functions&#xa;directions&#xa;vendors / integrators" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="app-layer"><mxGeometry x="170" y="140" width="130" height="140" as="geometry"/></mxCell>
        <mxCell id="tech-box" value="Technologies&#xa;catalog&#xa;coverage&#xa;readiness&#xa;proposals / moderation" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="app-layer"><mxGeometry x="320" y="140" width="150" height="130" as="geometry"/></mxCell>
        <mxCell id="ops-box" value="Operational modules&#xa;audit&#xa;metrics / health&#xa;export" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="app-layer"><mxGeometry x="20" y="330" width="170" height="130" as="geometry"/></mxCell>
        <mxCell id="policy-box" value="Security / policy&#xa;RBAC&#xa;CSRF / CORS&#xa;TLS / secure cookies" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;" vertex="1" parent="app-layer"><mxGeometry x="220" y="330" width="150" height="100" as="geometry"/></mxCell>
        <mxCell id="data-layer" value="Data layer" style="swimlane;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="1140" y="70" width="250" height="390" as="geometry"/></mxCell>
        <mxCell id="db-main" value="PostgreSQL&#xa;business data&#xa;auth state&#xa;audit metadata" style="shape=cylinder;whiteSpace=wrap;html=1;boundedLbl=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="data-layer"><mxGeometry x="40" y="60" width="140" height="100" as="geometry"/></mxCell>
        <mxCell id="db-backup" value="External SRK process&#xa;(outside MVP app)" style="shape=cylinder;whiteSpace=wrap;html=1;boundedLbl=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="data-layer"><mxGeometry x="40" y="220" width="140" height="80" as="geometry"/></mxCell>
        <mxCell id="ops-layer" value="Operations layer" style="swimlane;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="1450" y="70" width="190" height="390" as="geometry"/></mxCell>
        <mxCell id="release" value="CI/CD" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="ops-layer"><mxGeometry x="25" y="50" width="120" height="50" as="geometry"/></mxCell>
        <mxCell id="deploy" value="SSH deploy + systemd" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="ops-layer"><mxGeometry x="25" y="130" width="140" height="60" as="geometry"/></mxCell>
        <mxCell id="monitor" value="Monitoring / alerting" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="ops-layer"><mxGeometry x="25" y="230" width="140" height="60" as="geometry"/></mxCell>
        <mxCell id="ae1" value="HTTPS" style="endArrow=block;html=1;" edge="1" parent="1" source="actors" target="nginx-main"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae2" value="UI delivery" style="endArrow=block;html=1;" edge="1" parent="1" source="nginx-main" target="djui"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae3" value="API traffic" style="endArrow=block;html=1;" edge="1" parent="1" source="nginx-main" target="api-gateway"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae4" value="uses" style="endArrow=block;html=1;" edge="1" parent="app-layer" source="api-gateway" target="auth-box"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae5" value="uses" style="endArrow=block;html=1;" edge="1" parent="app-layer" source="api-gateway" target="ref-box"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae6" value="uses" style="endArrow=block;html=1;" edge="1" parent="app-layer" source="api-gateway" target="tech-box"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae7" value="uses" style="endArrow=block;html=1;" edge="1" parent="app-layer" source="api-gateway" target="ops-box"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae8" value="SQL" style="endArrow=block;html=1;" edge="1" parent="1" source="auth-box" target="db-main"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae9" value="SQL" style="endArrow=block;html=1;" edge="1" parent="1" source="ref-box" target="db-main"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae10" value="SQL" style="endArrow=block;html=1;" edge="1" parent="1" source="tech-box" target="db-main"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae11" value="SRK regulation reference" style="endArrow=block;html=1;" edge="1" parent="1" source="ops-box" target="db-backup"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae12" value="deploy" style="endArrow=block;html=1;" edge="1" parent="1" source="release" target="deploy"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae13" value="release update" style="endArrow=block;html=1;" edge="1" parent="1" source="deploy" target="gun"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ae14" value="metrics / logs" style="endArrow=block;html=1;" edge="1" parent="1" source="ops-box" target="monitor"><mxGeometry relative="1" as="geometry"/></mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

**Описание к рисунку 2**

Общая архитектурная схема предназначена для верхнеуровневого представления всей системы как единого корпоративного web-решения. Она показывает не отдельные внутренние модули, а основные архитектурные слои и направления взаимодействия между ними. За счёт этого диаграмма помогает быстро объяснить, из каких крупных частей состоит система и как организовано её размещение с точки зрения пользователя, приложения, данных и эксплуатации.

На левой стороне схемы расположены пользователи, которые обращаются к системе через браузер. Далее следует web-слой, представленный внешним `nginx`, страницами интерфейса и страницами аутентификации. Этот слой отвечает за публикацию интерфейса по `HTTPS`, первичную маршрутизацию запросов и доставку пользовательских страниц. На следующем уровне расположен прикладной слой, в котором выделены `Gunicorn`, доставка UI через `Django`, API-шлюз `/api/v1/*`, а также основные доменные блоки: аутентификация и роли, справочники, технологии, эксплуатационные функции и политики безопасности.

Отдельный слой данных содержит рабочую `PostgreSQL`-базу и ссылку на внешний контур `СРК` для резервирования (вне MVP приложения). Это подчёркивает, что бизнес-данные и состояние аутентификации хранятся централизованно в runtime-БД, а операции резервирования выполняются по корпоративному регламенту. Справа вынесен operations layer, в который входят поставка релизов, развёртывание и мониторинг. Такое выделение показывает, что эксплуатационные процессы не смешиваются с пользовательским runtime, а организуются как самостоятельный сопровождающий контур.

Связи между блоками отражают базовые направления обмена: пользовательский `HTTPS`-трафик идёт во внешний web-слой, затем запросы передаются в прикладной слой, прикладные компоненты работают с базой данных, а эксплуатационный слой обеспечивает поставку обновлений и получение метрик/логов. В результате схема фиксирует центральный архитектурный принцип проекта: единый пользовательский вход, единый backend-контур для UI и API, централизованное хранение данных и вынесенные процессы сопровождения.

#### Рисунок 3. Диаграмма компонентов системы (`draw.io / mxGraphModel`)

```xml
<mxfile host="app.diagrams.net" modified="2026-03-27T12:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="components-figure-3" name="Components">
    <mxGraphModel dx="1700" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="browser" value="Browser client" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="40" y="230" width="150" height="60" as="geometry"/></mxCell>
        <mxCell id="proxy" value="Nginx reverse proxy" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="1"><mxGeometry x="250" y="230" width="160" height="60" as="geometry"/></mxCell>
        <mxCell id="ui" value="Web UI layer&#xa;templates&#xa;static assets&#xa;forms / filters / radar view" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1"><mxGeometry x="480" y="80" width="180" height="120" as="geometry"/></mxCell>
        <mxCell id="api" value="REST API layer&#xa;/api/v1/*" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1"><mxGeometry x="480" y="250" width="180" height="80" as="geometry"/></mxCell>
        <mxCell id="authapp" value="auth_custom&#xa;users&#xa;roles&#xa;JWT lifecycle&#xa;2FA / TOTP" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1"><mxGeometry x="740" y="40" width="170" height="130" as="geometry"/></mxCell>
        <mxCell id="refapp" value="references&#xa;enterprises&#xa;blocks&#xa;functions&#xa;directions&#xa;vendors / integrators" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1"><mxGeometry x="740" y="200" width="170" height="150" as="geometry"/></mxCell>
        <mxCell id="techapp" value="technologies&#xa;catalog&#xa;readiness&#xa;coverage&#xa;proposals / moderation" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1"><mxGeometry x="950" y="40" width="180" height="140" as="geometry"/></mxCell>
        <mxCell id="adminapp" value="admin_panel&#xa;admin users&#xa;audit&#xa;metrics" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1"><mxGeometry x="950" y="220" width="180" height="140" as="geometry"/></mxCell>
        <mxCell id="docs" value="OpenAPI / docs / runbooks" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;" vertex="1" parent="1"><mxGeometry x="740" y="390" width="170" height="60" as="geometry"/></mxCell>
        <mxCell id="db" value="PostgreSQL 14+" style="shape=cylinder;whiteSpace=wrap;html=1;boundedLbl=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1"><mxGeometry x="1210" y="170" width="150" height="90" as="geometry"/></mxCell>
        <mxCell id="ce1" value="HTTPS" style="endArrow=block;html=1;" edge="1" parent="1" source="browser" target="proxy"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce2" value="deliver pages" style="endArrow=block;html=1;" edge="1" parent="1" source="proxy" target="ui"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce3" value="API calls" style="endArrow=block;html=1;" edge="1" parent="1" source="ui" target="api"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce4" value="auth" style="endArrow=block;html=1;" edge="1" parent="1" source="api" target="authapp"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce5" value="references" style="endArrow=block;html=1;" edge="1" parent="1" source="api" target="refapp"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce6" value="technologies" style="endArrow=block;html=1;" edge="1" parent="1" source="api" target="techapp"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce7" value="admin / ops" style="endArrow=block;html=1;" edge="1" parent="1" source="api" target="adminapp"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce8" value="specification" style="endArrow=block;html=1;" edge="1" parent="1" source="api" target="docs"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce9" value="read / write" style="endArrow=block;html=1;" edge="1" parent="1" source="authapp" target="db"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce10" value="read / write" style="endArrow=block;html=1;" edge="1" parent="1" source="refapp" target="db"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce11" value="read / write" style="endArrow=block;html=1;" edge="1" parent="1" source="techapp" target="db"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="ce12" value="read / write" style="endArrow=block;html=1;" edge="1" parent="1" source="adminapp" target="db"><mxGeometry relative="1" as="geometry"/></mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

**Описание к рисунку 3**

Диаграмма компонентов детализирует прикладной слой системы и показывает, из каких логических модулей состоит backend-приложение. Если общая архитектурная схема задаёт крупные слои, то эта диаграмма уже раскрывает внутренний состав приложения и помогает понять, как распределены прикладные обязанности между отдельными подсистемами.

Слева показаны браузерный клиент и `nginx reverse proxy`, через которые пользователь получает страницы и выполняет API-вызовы. Далее идут два узла прикладного входа: `Web UI layer`, который отвечает за шаблоны, статические ресурсы, формы и визуальные представления, и `REST API layer`, который выступает единой точкой входа для клиент-серверного взаимодействия через `/api/v1/*`. Эти два элемента образуют общий прикладной фасад системы.

Правее расположены основные доменные компоненты. Блок `auth_custom` отвечает за пользователей, роли, жизненный цикл токенов и сценарии `2FA / TOTP`. Блок `references` содержит справочники предприятий, блоков, функций, направлений, вендоров и интеграторов. Блок `technologies` концентрирует предметную область каталога технологий, готовности, покрытия функций, предложений и модерации. Блок `admin_panel` отвечает за административные функции, аудит и метрики. Отдельно вынесен узел `OpenAPI / docs / runbooks`, который показывает, что документация и контракт API рассматриваются как полноценная часть архитектуры, а не как внешний необязательный артефакт.

Все прикладные модули связаны с единой `PostgreSQL`-базой, что подчёркивает целостность модели данных. Стрелки от API-слоя к доменным блокам показывают, что клиент взаимодействует не с разрозненными сервисами, а с единым приложением, внутри которого логически разделены домены ответственности. Практический смысл этой схемы в том, чтобы показать модульность backend-а: система остаётся цельной на уровне runtime, но внутри организована как набор чётко различимых прикладных подсистем.

## 6. Требуемые интеграции с существующим контуром

### 6.1 Интеграции первого этапа

На первом этапе система проектируется как изолированное корпоративное приложение со следующими обязательными интеграциями:

- пользовательский доступ по `HTTPS`;
- взаимодействие `nginx` с прикладным сервером;
- взаимодействие прикладного сервера с `PostgreSQL`;
- эксплуатационное взаимодействие через `SSH` и `systemd`;
- взаимодействие с внешним регламентом `СРК` для операций резервирования.

### 6.2 Методы интеграции

- `HTTPS` для пользовательского доступа;
- `REST API / JSON` для клиент-серверного обмена;
- native protocol `PostgreSQL` для взаимодействия backend и БД;
- `SSH` для deployment и сопровождения;
- файловый обмен для экспортных материалов; резервирование выполняется по внешнему регламенту `СРК`.

### 6.3 Потоки данных

Основные потоки данных в системе:

1. Пользователь подключается к системе по `HTTPS`.
2. `nginx` принимает входящий запрос и маршрутизирует его в `Django/Gunicorn`.
3. Backend выполняет аутентификацию, проверку ролей и бизнес-логику.
4. Backend выполняет чтение и запись данных в `PostgreSQL`.
5. Пользователь получает HTML и/или JSON-ответ.
6. Административные операции проходят через тот же backend-контур с отдельными правами доступа.

### 6.4 Интеграции следующего этапа

На следующем этапе архитектура должна допускать подключение:

- корпоративного `SSO/IAM`;
- внешней системы уведомлений;
- внешнего файлового или объектного хранилища;
- централизованного мониторинга и alerting;
- внешних корпоративных систем через API;
- выделенного vendor-контура.

## 7. Техническая информация о работе системы

### 7.1 Runtime-модель

Целевая модель работы системы:

- `nginx` принимает внешний трафик;
- `Gunicorn` обслуживает `Django`-приложение;
- backend отдает API и web-интерфейс;
- `PostgreSQL` обеспечивает постоянное хранение данных;
- `systemd` управляет жизненным циклом сервисов;
- CI/CD обеспечивает доставку изменений в тестовый и целевой контуры.

### 7.2 Аутентификация и безопасность

Проектируемая модель доступа:

- логин через backend API;
- создание учётных записей администратором с выдачей временного пароля;
- обязательная смена временного пароля при первом успешном входе до завершения пользовательской сессии;
- разграничение доступа по ролям;
- двухфакторная аутентификация `TOTP`;
- использование безопасных cookie и TLS в test/prod контурах;
- защита от XSS, CSRF, brute-force и несанкционированного доступа;
- обязательное журналирование значимых действий.

#### Рисунок 6. Диаграмма последовательности аутентификации с 2FA (`draw.io / mxGraphModel`)

```xml
<mxfile host="app.diagrams.net" modified="2026-03-27T12:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="auth-sequence-figure-6" name="Auth 2FA sequence">
    <mxGraphModel dx="1700" dy="1100" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="p1" value="Пользователь" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="60" y="30" width="120" height="880" as="geometry"/></mxCell>
        <mxCell id="p2" value="Web UI" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="280" y="30" width="120" height="880" as="geometry"/></mxCell>
        <mxCell id="p3" value="Backend API" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="520" y="30" width="120" height="880" as="geometry"/></mxCell>
        <mxCell id="p4" value="Auth / TOTP service" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="760" y="30" width="140" height="880" as="geometry"/></mxCell>
        <mxCell id="p5" value="PostgreSQL" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="1020" y="30" width="120" height="880" as="geometry"/></mxCell>
        <mxCell id="alt1" value="Ветка A: первичный вход без включённого 2FA" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="1180" y="120" width="240" height="70" as="geometry"/></mxCell>
        <mxCell id="alt2" value="Ветка B: вход при уже включённом 2FA" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="1180" y="400" width="240" height="70" as="geometry"/></mxCell>
        <mxCell id="alt3" value="Ветка C: завершение сессии и получение пользовательского контекста" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="1180" y="690" width="240" height="80" as="geometry"/></mxCell>
        <mxCell id="m1" value="1. Ввод логина и пароля" style="endArrow=block;html=1;" edge="1" parent="1" source="p1" target="p2"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="m2" value="2. POST /auth/login/" style="endArrow=block;html=1;" edge="1" parent="1" source="p2" target="p3"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="150" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m3" value="3. Проверка пользователя и роли" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p5"><mxGeometry relative="1" as="geometry"><mxPoint x="1000" y="190" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m4" value="4. Определить режим аутентификации" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p4"><mxGeometry relative="1" as="geometry"><mxPoint x="740" y="230" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m5" value="5A. Если 2FA не включён: вернуть challenge setup" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p2"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="270" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m6" value="6A. Открыть /auth/2fa/setup/" style="endArrow=block;html=1;" edge="1" parent="1" source="p2" target="p3"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="310" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m7" value="7A. Сгенерировать TOTP secret и provisioning URI" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p4"><mxGeometry relative="1" as="geometry"><mxPoint x="740" y="350" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m8" value="8A. Сохранить secret / статус профиля" style="endArrow=block;html=1;" edge="1" parent="1" source="p4" target="p5"><mxGeometry relative="1" as="geometry"><mxPoint x="1000" y="390" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m9" value="9A. Отобразить QR и запросить код подтверждения" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p2"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="430" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m10" value="5B. Если 2FA уже включён: вернуть challenge verify" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p2"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="470" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m11" value="10. Ввод TOTP-кода" style="endArrow=block;html=1;" edge="1" parent="1" source="p1" target="p2"><mxGeometry relative="1" as="geometry"><mxPoint x="260" y="510" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m12" value="11. POST /auth/2fa/verify/" style="endArrow=block;html=1;" edge="1" parent="1" source="p2" target="p3"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="550" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m13" value="12. Получить secret и параметры пользователя" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p5"><mxGeometry relative="1" as="geometry"><mxPoint x="1000" y="590" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m14" value="13. Проверить код TOTP" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p4"><mxGeometry relative="1" as="geometry"><mxPoint x="740" y="630" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m15" value="14. При неуспехе: ошибка / повторный ввод" style="endArrow=block;html=1;dashed=1;" edge="1" parent="1" source="p3" target="p2"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="670" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m16" value="15. При успехе: выпустить access token" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p2"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="710" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m17" value="16. Сохранить refresh token / сессию" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p5"><mxGeometry relative="1" as="geometry"><mxPoint x="1000" y="750" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m18" value="17. Установить secure cookie" style="endArrow=block;html=1;" edge="1" parent="1" source="p2" target="p1"><mxGeometry relative="1" as="geometry"><mxPoint x="180" y="790" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m19" value="18. GET /api/v1/users/me" style="endArrow=block;html=1;" edge="1" parent="1" source="p2" target="p3"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="830" as="targetPoint"/></mxGeometry></mxCell>
        <mxCell id="m20" value="19. Вернуть профиль, роль и права" style="endArrow=block;html=1;" edge="1" parent="1" source="p3" target="p2"><mxGeometry relative="1" as="geometry"><mxPoint x="500" y="870" as="targetPoint"/></mxGeometry></mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

**Описание к рисунку 6**

Диаграмма последовательности аутентификации показывает полный сценарий входа пользователя в систему с поддержкой двухфакторной аутентификации `TOTP`. Она важна тем, что раскрывает процесс входа не как один запрос, а как согласованную последовательность действий между пользователем, web UI, backend API, сервисом проверки второго фактора и базой данных.

В начале сценария пользователь вводит логин и пароль, после чего web UI отправляет `POST /auth/login/` в backend. Backend обращается к базе данных для проверки пользователя и роли, а затем определяет режим аутентификации. Если для учётной записи установлен временный пароль, пользователь сначала переводится в отдельный сценарий обязательной смены пароля, и только после успешной замены может завершить вход. Такой шаг нужен для того, чтобы первоначально выданный администратором пароль не использовался как постоянный.

После проверки требования смены пароля схема разветвляется на две логические ветки `2FA`. Если `2FA` ещё не включён, backend возвращает challenge на настройку, пользователь открывает страницу `/auth/2fa/setup/`, backend и сервис `TOTP` генерируют secret и provisioning URI, данные сохраняются в БД, а пользователю отображается QR-код и предлагается выполнить подтверждение.

Если `2FA` уже включён, после первичной проверки логина и пароля или после завершения обязательной смены временного пароля backend переводит пользователя в сценарий подтверждения. Пользователь вводит `TOTP`-код, web UI вызывает `POST /auth/2fa/verify/`, backend получает секрет и параметры пользователя из БД и проверяет код через сервис второго фактора. При ошибке пользователь возвращается к повторному вводу, при успехе backend выпускает access token, сохраняет refresh token или сессию и инициирует установку защищённой cookie.

Финальная часть диаграммы показывает, что успешный вход не заканчивается выпуском токена: после этого web UI запрашивает `GET /api/v1/users/me`, а backend возвращает профиль пользователя, роль и права. Именно этот шаг завершает формирование пользовательского контекста. Схема тем самым подчёркивает, что безопасная аутентификация в системе включает управление состоянием `2FA`, хранение сессионных данных и обязательную загрузку ролевого профиля после входа.

### 7.3 API-модель

Проектируемое API должно включать следующие группы endpoint-ов:

- `auth`;
- `users`;
- `technologies`;
- `references`;
- `enterprises`;
- `technology proposals / moderation`;
- `export`;
- `audit`;
- `backup / restore` (вне MVP API; выполняется по регламенту `СРК`);
- `health / metrics / docs`.

### 7.4 Документация системы

Для системы должны быть сформированы и сопровождаться:

- техническое задание;
- архитектурное описание;
- ERD-диаграмма;
- OpenAPI schema;
- описание ролевой модели;
- release и deployment runbook;
- ссылка на регламент `СРК` по резервированию и восстановлению (Confluence);
- регрессионные и smoke-checklists;
- эксплуатационные инструкции для тестового и промышленного контуров.

#### Рисунок 7. Диаграмма развёртывания системы (`draw.io / mxGraphModel`)

```xml
<mxfile host="app.diagrams.net" modified="2026-03-30T12:00:00Z" agent="Codex" version="24.7.17" type="device">
  <diagram id="deployment-figure-7" name="&#1056;&#1072;&#1079;&#1074;&#1105;&#1088;&#1090;&#1099;&#1074;&#1072;&#1085;&#1080;&#1077; &#1089;&#1080;&#1089;&#1090;&#1077;&#1084;&#1099;">
    <mxGraphModel dx="1422" dy="744" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2200" pageHeight="1400" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="&#1044;&#1080;&#1072;&#1075;&#1088;&#1072;&#1084;&#1084;&#1072; &#1088;&#1072;&#1079;&#1074;&#1105;&#1088;&#1090;&#1099;&#1074;&#1072;&#1085;&#1080;&#1103; &#1074;&#1077;&#1073;-&#1089;&#1077;&#1088;&#1074;&#1080;&#1089;&#1072; &#171;&#1056;&#1072;&#1076;&#1072;&#1088; &#1090;&#1077;&#1093;&#1085;&#1086;&#1083;&#1086;&#1075;&#1080;&#1081;&#187;" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=18;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="600" y="20" width="800" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="10" value="&#1050;&#1086;&#1088;&#1087;&#1086;&#1088;&#1072;&#1090;&#1080;&#1074;&#1085;&#1072;&#1103; &#1080;&#1085;&#1092;&#1088;&#1072;&#1089;&#1090;&#1088;&#1091;&#1082;&#1090;&#1091;&#1088;&#1072;" style="swimlane;html=1;startSize=30;container=1;recursiveResize=0;collapsible=0;rounded=1;strokeColor=#2C3E50;fillColor=#ECF0F1;fontStyle=1" vertex="1" parent="1">
          <mxGeometry x="30" y="70" width="2100" height="1250" as="geometry"/>
        </mxCell>
        <mxCell id="11" value="DMZ / &#1042;&#1085;&#1077;&#1096;&#1085;&#1080;&#1081; &#1082;&#1086;&#1085;&#1090;&#1091;&#1088;" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#E74C3C;fillColor=#FADBD8;fontStyle=1;fontSize=11" vertex="1" parent="10">
          <mxGeometry x="40" y="50" width="380" height="230" as="geometry"/>
        </mxCell>
        <mxCell id="12" value="&#1042;&#1085;&#1077;&#1096;&#1085;&#1080;&#1081; reverse proxy&#xa;(nginx)" style="shape=process;html=1;whiteSpace=wrap;fillColor=#F5B7B1;strokeColor=#E74C3C" vertex="1" parent="11">
          <mxGeometry x="90" y="45" width="200" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="13" value="TLS termination&#xa;HTTPS 443, HSTS, redirect 80-&gt;443" style="shape=lock;html=1;whiteSpace=wrap;fillColor=#F5B7B1;strokeColor=#E74C3C;fontSize=9" vertex="1" parent="11">
          <mxGeometry x="90" y="120" width="200" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="20" value="&#1055;&#1088;&#1080;&#1082;&#1083;&#1072;&#1076;&#1085;&#1086;&#1081; &#1082;&#1086;&#1085;&#1090;&#1091;&#1088;" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#3498DB;fillColor=#EBF5FB;fontStyle=1;fontSize=11" vertex="1" parent="10">
          <mxGeometry x="450" y="50" width="860" height="520" as="geometry"/>
        </mxCell>
        <mxCell id="21" value="Web/App host&#xa;(Debian 12)" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#1ABC9C;fillColor=#E8F8F5;fontStyle=1;fontSize=10" vertex="1" parent="20">
          <mxGeometry x="30" y="40" width="250" height="220" as="geometry"/>
        </mxCell>
        <mxCell id="22" value="Django templates + staticfiles&#xa;&#1094;&#1077;&#1083;&#1077;&#1074;&#1086;&#1081; same-origin frontend runtime&#xa;SERVE_FRONTEND_FROM_DJANGO=True" style="shape=folder;html=1;whiteSpace=wrap;fillColor=#A9DFBF;strokeColor=#1ABC9C;fontSize=9" vertex="1" parent="21">
          <mxGeometry x="25" y="40" width="200" height="95" as="geometry"/>
        </mxCell>
        <mxCell id="23" value="collectstatic -&gt; backend/staticfiles&#xa;/, /radar/, /admin-panel/, auth pages" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#A9DFBF;strokeColor=#1ABC9C;fontSize=9" vertex="1" parent="21">
          <mxGeometry x="25" y="145" width="200" height="55" as="geometry"/>
        </mxCell>
        <mxCell id="30" value="Backend runtime&#xa;(gunicorn + Django 6 / Python 3.14)" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#9B59B6;fillColor=#F4ECF7;fontStyle=1;fontSize=10" vertex="1" parent="20">
          <mxGeometry x="310" y="40" width="260" height="360" as="geometry"/>
        </mxCell>
        <mxCell id="31" value="gunicorn&#xa;WSGI entrypoint&#xa;systemd managed" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#D7BDE2;strokeColor=#9B59B6;fontSize=9" vertex="1" parent="30">
          <mxGeometry x="25" y="40" width="210" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="32" value="Django application&#xa;UI + REST API&#xa;/api/v1/*" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#D7BDE2;strokeColor=#9B59B6;fontSize=9" vertex="1" parent="30">
          <mxGeometry x="25" y="115" width="210" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="33" value="Auth/security&#xa;cookie refresh auth&#xa;2FA (TOTP), CSRF, CSP" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#D7BDE2;strokeColor=#9B59B6;fontSize=9" vertex="1" parent="30">
          <mxGeometry x="25" y="190" width="210" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="34" value="Business modules&#xa;technologies, references, enterprises&#xa;technology proposals, admin-panel, export" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#D7BDE2;strokeColor=#9B59B6;fontSize=9" vertex="1" parent="30">
          <mxGeometry x="25" y="275" width="210" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="40" value="Observability / service endpoints" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#F39C12;fillColor=#FEF5E7;fontStyle=1;fontSize=10" vertex="1" parent="20">
          <mxGeometry x="600" y="40" width="230" height="220" as="geometry"/>
        </mxCell>
        <mxCell id="41" value="Runtime endpoints&#xa;/api/v1/health&#xa;/api/v1/openapi.json&#xa;/api/v1/docs" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#F9E79F;strokeColor=#F39C12;fontSize=9" vertex="1" parent="40">
          <mxGeometry x="20" y="40" width="190" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="42" value="Metrics and logs&#xa;/api/v1/metrics (admin only)&#xa;app/auth/audit counters, service logs" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#F9E79F;strokeColor=#F39C12;fontSize=9" vertex="1" parent="40">
          <mxGeometry x="20" y="135" width="190" height="65" as="geometry"/>
        </mxCell>
        <mxCell id="50" value="&#1050;&#1086;&#1085;&#1090;&#1091;&#1088; &#1076;&#1072;&#1085;&#1085;&#1099;&#1093;" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#27AE60;fillColor=#E8F8F0;fontStyle=1;fontSize=11" vertex="1" parent="10">
          <mxGeometry x="450" y="600" width="860" height="330" as="geometry"/>
        </mxCell>
        <mxCell id="51" value="PostgreSQL 14+&#xa;(primary runtime DB)" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#27AE60;fillColor=#D5E8D4;fontStyle=1;fontSize=10" vertex="1" parent="50">
          <mxGeometry x="30" y="40" width="390" height="240" as="geometry"/>
        </mxCell>
        <mxCell id="52" value="&#1054;&#1089;&#1085;&#1086;&#1074;&#1085;&#1072;&#1103; &#1041;&#1044;&#xa;PostgreSQL 14+&#xa;&#1087;&#1086;&#1088;&#1090; 5432" style="shape=cylinder3;html=1;whiteSpace=wrap;fillColor=#A9DFBF;strokeColor=#27AE60;fontSize=9" vertex="1" parent="51">
          <mxGeometry x="35" y="40" width="150" height="75" as="geometry"/>
        </mxCell>
        <mxCell id="53" value="&#1044;&#1072;&#1085;&#1085;&#1099;&#1077; &#1076;&#1086;&#1084;&#1077;&#1085;&#1072;&#xa;technologies, references, enterprises&#xa;users, audit, proposals" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#A9DFBF;strokeColor=#27AE60;fontSize=9" vertex="1" parent="51">
          <mxGeometry x="205" y="40" width="150" height="95" as="geometry"/>
        </mxCell>
        <mxCell id="54" value="&#1054;&#1087;&#1077;&#1088;&#1072;&#1094;&#1080;&#1080; &#1089;&#1086;&#1087;&#1088;&#1086;&#1074;&#1086;&#1078;&#1076;&#1077;&#1085;&#1080;&#1103;&#xa;django migrate&#xa;seed_references, seed_technologies, seed_users" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#A9DFBF;strokeColor=#27AE60;fontSize=9" vertex="1" parent="51">
          <mxGeometry x="35" y="140" width="320" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="60" value="&#1042;&#1085;&#1077;&#1096;&#1085;&#1080;&#1081; &#1082;&#1086;&#1085;&#1090;&#1091;&#1088; &#1057;&#1056;&#1050;&#xa;backup / restore &#1074;&#1085;&#1077; MVP app" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#16A085;fillColor=#D1F2EB;fontStyle=1;fontSize=10" vertex="1" parent="50">
          <mxGeometry x="450" y="40" width="350" height="240" as="geometry"/>
        </mxCell>
        <mxCell id="61" value="Confluence / SRK regulation&#xa;retention, access policy&#xa;restore drill evidence" style="shape=folder;html=1;whiteSpace=wrap;fillColor=#76D7C4;strokeColor=#16A085;fontSize=9" vertex="1" parent="60">
          <mxGeometry x="40" y="40" width="260" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="62" value="&#1055;&#1088;&#1086;&#1094;&#1077;&#1089;&#1089; &#1074;&#1099;&#1085;&#1077;&#1089;&#1077;&#1085; &#1074;&#1086; &#1074;&#1085;&#1077;&#1096;&#1085;&#1080;&#1081; &#1082;&#1086;&#1085;&#1090;&#1091;&#1088; &#1080;&#1085;&#1092;&#1088;&#1072;&#1089;&#1090;&#1088;&#1091;&#1082;&#1090;&#1091;&#1088;&#1099;" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#76D7C4;strokeColor=#16A085;fontSize=9" vertex="1" parent="60">
          <mxGeometry x="40" y="175" width="260" height="35" as="geometry"/>
        </mxCell>
        <mxCell id="70" value="&#1048;&#1085;&#1092;&#1088;&#1072;&#1089;&#1090;&#1088;&#1091;&#1082;&#1090;&#1091;&#1088;&#1085;&#1099;&#1077; &#1089;&#1077;&#1088;&#1074;&#1080;&#1089;&#1099;" style="swimlane;html=1;startSize=25;container=1;rounded=1;strokeColor=#7F8C8D;fillColor=#F2F4F4;fontStyle=1;fontSize=11" vertex="1" parent="10">
          <mxGeometry x="1340" y="50" width="420" height="880" as="geometry"/>
        </mxCell>
        <mxCell id="71" value="Service management&#xa;systemd unit for gunicorn&#xa;env profile, restart, autostart" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#D5DBDB;strokeColor=#7F8C8D;fontSize=10" vertex="1" parent="70">
          <mxGeometry x="40" y="40" width="340" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="72" value="Release / CI-CD contour&#xa;repository, CI, delivery of artifacts&#xa;deploy runbooks and smoke protocol" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#D5DBDB;strokeColor=#7F8C8D;fontSize=10" vertex="1" parent="70">
          <mxGeometry x="40" y="135" width="340" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="73" value="Monitoring / diagnostics contour&#xa;corporate monitoring or Prometheus/Grafana-compatible tooling&#xa;log collection and smoke checks" style="rounded=1;html=1;whiteSpace=wrap;fillColor=#D5DBDB;strokeColor=#7F8C8D;fontSize=10" vertex="1" parent="70">
          <mxGeometry x="40" y="230" width="340" height="85" as="geometry"/>
        </mxCell>
        <mxCell id="100" value="&#1055;&#1086;&#1083;&#1100;&#1079;&#1086;&#1074;&#1072;&#1090;&#1077;&#1083;&#1100;&#xa;(&#1073;&#1088;&#1072;&#1091;&#1079;&#1077;&#1088;)" style="shape=actor;html=1;whiteSpace=wrap;fillColor=#FFF2CC;strokeColor=#D6B656" vertex="1" parent="1">
          <mxGeometry x="150" y="1350" width="50" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="101" value="&#1040;&#1076;&#1084;&#1080;&#1085;&#1080;&#1089;&#1090;&#1088;&#1072;&#1090;&#1086;&#1088;" style="shape=actor;html=1;whiteSpace=wrap;fillColor=#FFF2CC;strokeColor=#D6B656" vertex="1" parent="1">
          <mxGeometry x="280" y="1350" width="50" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="102" value="Release owner / DevOps" style="shape=actor;html=1;whiteSpace=wrap;fillColor=#FFF2CC;strokeColor=#D6B656" vertex="1" parent="1">
          <mxGeometry x="430" y="1350" width="60" height="70" as="geometry"/>
        </mxCell>
        <mxCell id="200" value="HTTPS (443)&#xa;UI + API&#xa;same-origin access" style="endArrow=classic;html=1;rounded=0;strokeColor=#34495E;strokeWidth=2" edge="1" parent="1" source="100" target="12">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="175" y="1350"/>
              <mxPoint x="190" y="300"/>
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="201" value="&#1057;&#1090;&#1088;&#1072;&#1085;&#1080;&#1094;&#1099; + staticfiles" style="endArrow=classic;html=1;rounded=0;strokeColor=#1ABC9C" edge="1" parent="1" source="12" target="22">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="202" value="WSGI / reverse proxy&#xa;127.0.0.1:8000" style="endArrow=classic;html=1;rounded=0;strokeColor=#9B59B6;strokeWidth=2" edge="1" parent="1" source="12" target="31">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="203" value="ORM / SQL&#xa;CRUD + auth + audit" style="endArrow=classic;html=1;rounded=0;strokeColor=#27AE60;strokeWidth=2" edge="1" parent="1" source="32" target="52">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="204" value="DB migrations / seeds" style="endArrow=classic;html=1;rounded=0;strokeColor=#27AE60;dashed=1" edge="1" parent="1" source="34" target="54">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="205" value="SRK process reference" style="endArrow=classic;html=1;rounded=0;strokeColor=#16A085" edge="1" parent="1" source="34" target="61">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="206" value="Health / docs / OpenAPI" style="endArrow=classic;html=1;rounded=0;strokeColor=#F39C12" edge="1" parent="1" source="32" target="41">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="207" value="Metrics / logs" style="endArrow=classic;html=1;rounded=0;strokeColor=#F39C12;dashed=1" edge="1" parent="1" source="32" target="42">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="208" value="Monitoring / log collection" style="endArrow=classic;html=1;rounded=0;strokeColor=#7F8C8D;dashed=1" edge="1" parent="1" source="42" target="73">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="209" value="Deploy / restart&#xa;runbook-driven" style="endArrow=classic;html=1;rounded=0;strokeColor=#7F8C8D;dashed=1" edge="1" parent="1" source="72" target="71">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="210" value="Release artifact + smoke evidence" style="endArrow=classic;html=1;rounded=0;strokeColor=#7F8C8D;dashed=1" edge="1" parent="1" source="102" target="72">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="211" value="SSH (22)&#xa;ops access" style="endArrow=classic;html=1;rounded=0;strokeColor=#34495E;dashed=1" edge="1" parent="1" source="101" target="71">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="900" value="&#1058;&#1077;&#1082;&#1091;&#1097;&#1080;&#1081; &#1094;&#1077;&#1083;&#1077;&#1074;&#1086;&#1081; baseline:&#xa;&#8226; Debian 12 + nginx + gunicorn&#xa;&#8226; Django 6 / Python 3.14&#xa;&#8226; PostgreSQL-only runtime&#xa;&#8226; same-origin frontend &#1095;&#1077;&#1088;&#1077;&#1079; Django" style="note;html=1;whiteSpace=wrap;fillColor=#FEF5E7;strokeColor=#F39C12;fontSize=9" vertex="1" parent="1">
          <mxGeometry x="500" y="965" width="230" height="105" as="geometry"/>
        </mxCell>
        <mxCell id="901" value="Security/runtime baseline:&#xa;&#8226; cookie refresh auth + 2FA&#xa;&#8226; CSRF, CSP, Secure cookies&#xa;&#8226; /api/v1/metrics &#1090;&#1086;&#1083;&#1100;&#1082;&#1086; &#1076;&#1083;&#1103; admin&#xa;&#8226; HTTPS &#1086;&#1073;&#1103;&#1079;&#1072;&#1090;&#1077;&#1083;&#1077;&#1085;" style="note;html=1;whiteSpace=wrap;fillColor=#EBF5FB;strokeColor=#3498DB;fontSize=9" vertex="1" parent="1">
          <mxGeometry x="1360" y="350" width="210" height="105" as="geometry"/>
        </mxCell>
        <mxCell id="950" value="&#1059;&#1089;&#1083;&#1086;&#1074;&#1085;&#1099;&#1077; &#1086;&#1073;&#1086;&#1079;&#1085;&#1072;&#1095;&#1077;&#1085;&#1080;&#1103;:" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;fontStyle=1;fontSize=11" vertex="1" parent="1">
          <mxGeometry x="1780" y="100" width="200" height="150" as="geometry"/>
        </mxCell>
        <mxCell id="951" value="&#8212; HTTPS / runtime traffic" style="line;html=1;strokeColor=#34495E;strokeWidth=2" edge="1" parent="1">
          <mxGeometry x="1790" y="125" width="180" height="0" as="geometry"/>
        </mxCell>
        <mxCell id="952" value="&#8212; &#8212; Ops / monitoring / CI-CD" style="line;html=1;strokeColor=#7F8C8D;strokeWidth=1;dashed=1" edge="1" parent="1">
          <mxGeometry x="1790" y="145" width="180" height="0" as="geometry"/>
        </mxCell>
        <mxCell id="953" value="&#9632; &#1055;&#1088;&#1080;&#1082;&#1083;&#1072;&#1076;&#1085;&#1086;&#1081; &#1082;&#1086;&#1084;&#1087;&#1086;&#1085;&#1077;&#1085;&#1090;" style="shape=rectangle;whiteSpace=wrap;html=1;fillColor=#EBF5FB;strokeColor=#3498DB;fontSize=9" vertex="1" parent="1">
          <mxGeometry x="1790" y="170" width="180" height="22" as="geometry"/>
        </mxCell>
        <mxCell id="954" value="&#9632; &#1050;&#1086;&#1085;&#1090;&#1091;&#1088; &#1093;&#1088;&#1072;&#1085;&#1077;&#1085;&#1080;&#1103; &#1076;&#1072;&#1085;&#1085;&#1099;&#1093;" style="shape=rectangle;whiteSpace=wrap;html=1;fillColor=#E8F8F0;strokeColor=#27AE60;fontSize=9" vertex="1" parent="1">
          <mxGeometry x="1790" y="195" width="180" height="22" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

**Описание к рисунку 7**

Диаграмма развёртывания показывает целевой вариант размещения системы в корпоративной инфраструктуре и объясняет, как логические части приложения распределяются по эксплуатационным зонам. В отличие от логических и компонентных схем, здесь акцент сделан не на доменных модулях, а на физическом и инфраструктурном размещении: где принимается внешний трафик, где исполняется прикладной runtime, где находятся данные и какие контуры отвечают за сопровождение, выпуск и наблюдаемость.

Верхний контейнер корпоративной инфраструктуры включает несколько крупных зон. Во внешнем контуре `DMZ` расположен `nginx`, который выполняет функции внешнего reverse proxy. Он принимает пользовательский `HTTPS`-трафик, завершает TLS-сессию, обеспечивает публикацию системы по защищённому каналу и передаёт запросы во внутренний прикладной контур. На схеме отдельно показан блок TLS termination, что подчёркивает важность безопасного входа и правильной обработки пользовательского трафика ещё на границе инфраструктуры.

Прикладной контур содержит сервер приложений под управлением `Debian 12`, блок same-origin доставки интерфейса через `Django templates + staticfiles`, а также собранную статику, публикуемую после `collectstatic`. Здесь же расположен backend runtime на `Gunicorn + Django`, внутри которого выделены точки входа WSGI, прикладное приложение, блоки аутентификации и безопасности, а также бизнес-модули системы. Отдельным подблоком вынесены сервисные endpoint'ы наблюдаемости: health-check, OpenAPI, встроенная документация и метрики. Это показывает, что прикладной слой не ограничивается только бизнес-логикой, а сразу включает механизмы эксплуатационного контроля.

Контур данных в `MVP` содержит рабочую `PostgreSQL`-базу, доменные данные и операции сопровождения (миграции, загрузка начальных данных). Резервирование и восстановление выполняются во внешнем эксплуатационном контуре по регламенту `СРК`; в приложении не разворачивается отдельный app-level блок backup storage.

Отдельным блоком показаны инфраструктурные сервисы. В них входят `Service management`, который отвечает за жизненный цикл сервисов через `systemd`, контур поставки `Release / CI-CD`, отражающий процессы сборки, доставки и развёртывания релизов, а также `Monitoring / diagnostics contour`, который описывает сбор логов, метрик и последующий мониторинг состояния системы. На диаграмме эти элементы вынесены за пределы прикладного runtime, потому что их задача - сопровождать основное приложение, а не участвовать напрямую в пользовательском сценарии.

В нижней части схемы показаны основные акторы: пользователь, администратор и `Release owner / DevOps`. Их связи с компонентами схемы помогают понять, кто именно взаимодействует с каждым инфраструктурным уровнем. Пользователь работает с системой по `HTTPS`, администратор получает эксплуатационный доступ, а выпуск и сопровождение релизов происходят через отдельный инфраструктурный контур.

Стрелки между блоками отражают ключевые эксплуатационные потоки: пользовательский трафик проходит через `nginx` к интерфейсу и API, backend работает с `PostgreSQL`, бизнес-модули инициируют миграции, сервисные endpoint'ы отдают сигналы для наблюдаемости, а контур поставки и управления сервисами обеспечивает выпуск изменений и поддержание работоспособности среды. Резервирование и восстановление выполняются по внешнему регламенту `СРК`.

## 8. Системные требования и целевой стек

### 8.1 Прикладной стек

Целевой технологический стек:

- backend: `Python`, `Django`, `Django REST Framework`;
- аутентификация и 2FA: backend-driven auth + `TOTP`;
- СУБД: `PostgreSQL 14+`;
- application server: `Gunicorn`;
- reverse proxy: `nginx`;
- frontend: web-интерфейс на `HTML5`, `CSS3`, `JavaScript ES6+`;
- серверная ОС: `Debian 12` или совместимая Linux-среда.

### 8.2 Логическая структура системы

Прикладная архитектура должна включать доменные блоки:

- пользователи и доступ;
- справочники;
- технологии;
- предприятия и оценки готовности;
- модерация изменений;
- аудит;
- интеграция с процессом резервирования/восстановления по регламенту `СРК` (вне MVP runtime);
- метрики и эксплуатационный контроль.

#### Рисунок 5. ERD-диаграмма базы данных (`draw.io / mxGraphModel`)

```xml
<mxfile host="app.diagrams.net" modified="2026-03-27T12:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="erd-figure-5" name="ERD">
    <mxGraphModel dx="1800" dy="1100" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="t1" value="User&#xa;PK id&#xa;username&#xa;email" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="30" y="30" width="150" height="110" as="geometry"/></mxCell>
        <mxCell id="t2" value="UserProfile&#xa;FK user_id&#xa;role&#xa;is_2fa_enabled&#xa;totp_secret" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="240" y="20" width="180" height="140" as="geometry"/></mxCell>
        <mxCell id="t3" value="RefreshToken&#xa;FK user_id&#xa;jti&#xa;expires_at&#xa;revoked_at" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="470" y="20" width="180" height="140" as="geometry"/></mxCell>
        <mxCell id="t4" value="Enterprise&#xa;PK id&#xa;name" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="30" y="260" width="150" height="90" as="geometry"/></mxCell>
        <mxCell id="t5" value="FunctionalBlock&#xa;PK id&#xa;name" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="250" y="260" width="160" height="90" as="geometry"/></mxCell>
        <mxCell id="t6" value="FunctionReference&#xa;PK id&#xa;FK block_id&#xa;name" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="460" y="250" width="180" height="110" as="geometry"/></mxCell>
        <mxCell id="t7" value="DigitalDirection&#xa;PK id&#xa;name&#xa;quadrant_code" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="690" y="250" width="180" height="110" as="geometry"/></mxCell>
        <mxCell id="t8" value="Vendor&#xa;PK id&#xa;name" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="910" y="250" width="130" height="90" as="geometry"/></mxCell>
        <mxCell id="t9" value="Integrator&#xa;PK id&#xa;name" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="1070" y="250" width="130" height="90" as="geometry"/></mxCell>
        <mxCell id="t10" value="Technology&#xa;PK id&#xa;name&#xa;description&#xa;trl_stage&#xa;status" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="700" y="20" width="180" height="150" as="geometry"/></mxCell>
        <mxCell id="t11" value="TechnologyFunctionCoverage&#xa;FK technology_id&#xa;FK function_id&#xa;coverage_level" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="920" y="20" width="210" height="130" as="geometry"/></mxCell>
        <mxCell id="t12" value="TechnologyDirection&#xa;FK technology_id&#xa;FK direction_id" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="1160" y="20" width="180" height="100" as="geometry"/></mxCell>
        <mxCell id="t13" value="TechnologyEnterpriseReadiness&#xa;FK technology_id&#xa;FK enterprise_id&#xa;tech_readiness&#xa;org_readiness&#xa;status" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="30" y="430" width="220" height="170" as="geometry"/></mxCell>
        <mxCell id="t14" value="TechnologyProposal&#xa;PK id&#xa;FK technology_id&#xa;FK created_by_id&#xa;FK reviewed_by_id&#xa;action&#xa;status" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="310" y="430" width="220" height="180" as="geometry"/></mxCell>
        <mxCell id="t15" value="AuditLog&#xa;PK id&#xa;FK actor_id&#xa;action_type&#xa;timestamp" style="shape=swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="590" y="450" width="180" height="130" as="geometry"/></mxCell>
        <mxCell id="rel1" value="1:1" style="endArrow=block;html=1;" edge="1" parent="1" source="t1" target="t2"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel2" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t1" target="t3"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel3" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t5" target="t6"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel4" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t10" target="t11"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel5" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t6" target="t11"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel6" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t10" target="t12"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel7" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t7" target="t12"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel8" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t10" target="t13"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel9" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t4" target="t13"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel10" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t10" target="t14"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel11" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t1" target="t14"><mxGeometry relative="1" as="geometry"/></mxCell>
        <mxCell id="rel12" value="1:N" style="endArrow=block;html=1;" edge="1" parent="1" source="t1" target="t15"><mxGeometry relative="1" as="geometry"/></mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

**Описание к рисунку 5**

ERD-диаграмма базы данных показывает логическую структуру основных сущностей системы и их взаимосвязи. Она нужна для того, чтобы зафиксировать предметную модель решения не в виде списка таблиц, а в виде связанной схемы, из которой видно, как устроены пользователи, роли, каталог технологий, справочники, модерация, аудит и эксплуатационные данные.

В пользовательском блоке показаны сущности `User`, `UserProfile` и `RefreshToken`. Они описывают базовую учётную запись пользователя, расширенный профиль с ролью и параметрами `2FA`, а также механизм хранения refresh-сессий. Связи между этими таблицами показывают, что один пользователь имеет один профиль, но может иметь несколько refresh-token или сессионных записей, что соответствует целевой модели аутентификации и управления доступом.

Справочная часть модели включает `Enterprise`, `FunctionalBlock`, `FunctionReference`, `DigitalDirection`, `Vendor` и `Integrator`. Эти сущности образуют организационно-функциональный каркас системы: предприятие задаёт контекст анализа, функциональные блоки и функции описывают бизнес-структуру, а цифровые направления, вендоры и интеграторы расширяют атрибутивную модель технологий и позволяют строить более детализированные связи в каталоге.

Предметная технологическая модель сосредоточена вокруг сущности `Technology`. С ней связаны таблицы `TechnologyFunctionCoverage`, которая показывает покрытие функций технологиями, `TechnologyDirection`, которая связывает технологии с направлениями, и `TechnologyEnterpriseReadiness`, которая отражает готовность конкретной технологии для конкретного предприятия. За счёт этих связей система может не только хранить описание технологии, но и показывать её применимость, зрелость и релевантность для разных организационных контуров.

Отдельный прикладной блок составляют `TechnologyProposal` и `AuditLog`. Первая сущность отвечает за предложения изменений и процессы модерации, вторая - за журналирование значимых действий пользователей. Наличие этих таблиц показывает, что система проектируется не как статичный каталог, а как управляемая среда изменения данных с трассируемой историей действий.

Связи между сущностями показывают, что база данных служит единым центром хранения каталога технологий, аутентификации, ролевой модели, справочников, модерации и аудита. Для `MVP` операции резервирования выведены во внешний контур `СРК` и не реализуются как app-level runtime процесс.

### 8.3 Клиентская среда

- современный браузер с поддержкой `HTML5`, `CSS3`, `JavaScript ES6+`;
- доступ к корпоративной сети или тестовому контуру;
- поддержка `HTTPS`;
- возможность использования приложения-аутентификатора для `TOTP`.

## 9. Сайзинг и вычислительные мощности

### 9.1 Допущение по вычислительным ресурсам

На момент архитектурной проработки точные параметры уже закупленных мощностей не зафиксированы. Поэтому sizing ниже является проектной оценкой для тестового контура и первичного запуска.

### 9.2 Рекомендуемый sizing для тестового контура

#### Вариант 1. Минимальный пилотный стенд

- 1 сервер;
- `4 vCPU`;
- `8 GB RAM`;
- `100 GB SSD`;
- совместное размещение `nginx + gunicorn + Django + PostgreSQL`.

#### Вариант 2. Предпочтительный тестовый контур

- сервер приложений:
  - `4 vCPU`;
  - `8-16 GB RAM`;
  - `50-100 GB SSD`;
- сервер БД:
  - `4 vCPU`;
  - `8-16 GB RAM`;
  - `100+ GB SSD`;
- отдельное размещение журналов; резервирование выносится во внешний контур по регламенту `СРК`.

### 9.3 Рекомендации по запасу

- резерв по CPU и RAM не менее `30%`;
- резерв диска под логи и экспортные артефакты; требования к backup storage задаются внешним регламентом `СРК`;
- возможность выделения отдельного сервера БД;
- возможность горизонтального масштабирования application-слоя;
- возможность подключения внешнего хранилища файлов и отчетов на следующих этапах.

## 10. Количество и категории пользователей будущей тестовой системы

### 10.1 Категории пользователей

Для тестовой системы закладываются следующие категории:

- `guest` - просмотр данных, фильтрация и экспорт;
- `editor` - инициирование изменений и работа через согласование;
- `owner` - прямое управление технологиями и утверждение изменений;
- `admin` - администрирование системы, пользователей и аудита; операции резервирования выполняются во внешнем контуре `СРК`;
- `vendor` - перспективный внешний пользовательский контур следующего этапа.

### 10.2 Рекомендуемый состав пилотного тестового контура

- `1-2` администратора;
- `2-5` владельцев;
- `5-15` редакторов;
- `10-30` пользователей чтения;
- `10-20` одновременно активных пользователей на тестовом стенде.

Эти значения являются проектными оценками и подлежат уточнению заказчиком.

## 11. Перспективы развития и масштабирования системы

- выделение контуров `dev / test / preprod / prod`;
- расширение справочников и предметной области без смены базовой архитектуры;
- развитие интеграций с корпоративными системами;
- внедрение расширенной аналитики и прогнозных моделей;
- внедрение backend-уведомлений и коллаборации;
- вынос тяжелых операций в фоновые задачи и очереди;
- масштабирование по нагрузке за счет горизонтального роста прикладного слоя;
- выделение БД и внешних хранилищ в отдельный контур;
- внедрение централизованного мониторинга и alerting;
- развитие SSO/IAM и внешнего vendor-контура.

## 12. Информация о необходимом доступе пользователей, разработчиков и администраторов

### 12.1 Пользователи системы

- доступ к web-интерфейсу по `HTTPS`;
- доступ к функциям строго в пределах назначенной роли;
- доступ к экспортам, просмотру и редактированию данных по матрице прав;
- получение учётной записи от администратора без self-registration;
- обязательная смена временного пароля при первом входе;
- использование 2FA в рамках корпоративной политики безопасности.

### 12.2 Разработчики

- доступ к репозиторию исходного кода;
- доступ к CI/CD журналам и артефактам сборки;
- доступ к тестовому контуру;
- доступ к логам приложения и диагностике тестовой среды;
- ограниченный доступ к тестовой БД;
- доступ к документации, схемам и API-спецификациям;
- доступ к секретам только через защищенный согласованный процесс.

### 12.3 Администраторы и эксплуатация

- доступ к серверам test/prod контуров;
- управление `nginx`, `gunicorn`, `systemd`, сертификатами и журналами;
- взаимодействие с внешним процессом backup/restore по регламенту `СРК`;
- доступ к метрикам и диагностике;
- контроль сетевых политик, TLS и эксплуатационной безопасности.

## 13. Архитектурные ограничения и допущения

- система проектируется как backend-centric web-решение;
- backend рассматривается как единственный источник истины по бизнес-данным и правам доступа;
- клиентское хранилище не должно являться каноническим источником бизнес-данных;
- целевая архитектура не должна зависеть от автономного mock-режима;
- внешние интеграции являются расширением следующего этапа и не должны ломать базовый API-контракт;
- точные объемы production-инфраструктуры подлежат уточнению на этапе инфраструктурного проектирования.

## 14. Архитектурный вывод

Веб-сервис «Радар технологий РМКД» должен проектироваться как корпоративная серверо-центричная информационно-аналитическая система с единым backend API, централизованной базой данных `PostgreSQL`, эксплуатацией в Linux-контуре и web-интерфейсом, предназначенным для работы архитекторов, экспертов, руководителей проектов и администраторов.

Целевая архитектура должна обеспечивать:

- надежное хранение и обработку бизнес-данных;
- ролевую модель доступа и двухфакторную аутентификацию;
- визуализацию технологического радара;
- управляемость, аудит и соблюдение регламента `СРК` по резервированию.
- возможность поэтапного масштабирования и развития без смены базового архитектурного подхода.

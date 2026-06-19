# WebRTC Screen Support — Vercel + Pusher

## Структура файлов

```
vercel-support/
├── api/
│   └── signal.js     — serverless function (сигналинг через Pusher)
├── client.html       — страница клиента
├── manager.html      — панель менеджера
├── vercel.json       — конфиг Vercel
└── README.md
```

## Деплой на Vercel

### 1. Установить Vercel CLI

```bash
npm install -g vercel
```

### 2. Задать переменные окружения в Vercel

В панели Vercel (vercel.com) → ваш проект → Settings → Environment Variables:

| Имя переменной    | Значение             |
|-------------------|----------------------|
| PUSHER_APP_ID     | 2168539              |
| PUSHER_KEY        | b5ac6b29dac2f1084e87 |
| PUSHER_SECRET     | 25b91db7eb256a1c7e45 |
| PUSHER_CLUSTER    | us2                  |

### 3. Задеплоить

```bash
cd vercel-support
vercel --prod
```

Или через GitHub: подключите репозиторий в vercel.com и задеплоится автоматически.

## Использование

- Клиент:  https://ВАШ_ДОМЕН.vercel.app/client
- Менеджер: https://ВАШ_ДОМЕН.vercel.app/manager

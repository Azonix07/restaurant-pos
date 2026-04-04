# 🍽️ Restaurant POS System

A full-featured desktop-based restaurant POS system with LAN-based multi-device support, built with **Electron**, **React**, **Node.js**, **MongoDB**, and **Socket.io**.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                Server PC (Main)                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Node.js  │  │ MongoDB  │  │ Socket.io     │  │
│  │ Express  │  │ Database │  │ Real-time Sync│  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│         http://192.168.x.x:5000                  │
└──────────────────────┬───────────────────────────┘
                       │ LAN / WiFi
       ┌───────────────┼───────────────┐
       │               │               │
┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
│  Billing PC │ │Kitchen Disp.│ │ Waiter Tab  │
│  (Electron) │ │  (Browser)  │ │  (Browser)  │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Features

| Module | Description |
|--------|-------------|
| **Authentication** | Role-based login (Admin, Manager, Cashier, Waiter) |
| **Orders** | Table-based ordering with real-time status updates |
| **Kitchen Display** | Live KDS with time tracking and item-level status |
| **Billing** | GST calculation, multiple payment methods, print bill |
| **QR Ordering** | Per-table QR codes for customer self-ordering |
| **External Orders** | Mock Swiggy/Zomato integration |
| **Reports** | Daily summary, item-wise sales, tax reports |
| **Accounting** | Expense tracking, profit & loss statements |
| **Notifications** | Email daily reports |
| **Backup** | Local MongoDB backup/restore |

## Prerequisites

- **Node.js** v18+
- **MongoDB** v6+ (running locally)
- **npm** v9+

## Quick Start

### 1. Install Dependencies

```bash
# From the project root
npm run install:all
```

### 2. Set Up Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env to set JWT_SECRET and other values
```

### 3. Seed Database

```bash
npm run seed
```

This creates:
- **Admin**: admin@restaurant.com / admin123
- **Manager**: manager@restaurant.com / manager123
- **Cashier**: cashier@restaurant.com / cashier123
- **Waiter**: waiter1@restaurant.com / waiter123
- 15 tables across 3 sections
- 23 menu items across 5 categories

### 4. Start Development

```bash
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Frontend
npm run dev:frontend

# Terminal 3 (optional) — Electron
npm run dev:electron
```

### 5. Access the App

- **Local**: http://localhost:3000 (React dev server)
- **LAN**: http://YOUR_IP:5000 (for other devices)
- **Kitchen Display**: Open /kitchen on any LAN device
- **QR Order**: Scan table QR code from customer phone

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/         # Database & app configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/      # Auth & error handling
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routes
│   │   ├── sockets/        # Socket.io event handlers
│   │   ├── utils/          # Backup, order number generator
│   │   ├── seed.js         # Database seeder
│   │   └── server.js       # Entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # Auth context
│   │   ├── hooks/          # Custom hooks (useSocket)
│   │   ├── pages/          # All page components
│   │   ├── services/       # API client & socket client
│   │   ├── App.js          # Route definitions
│   │   └── index.js        # Entry point
│   └── package.json
├── electron/
│   ├── main.js             # Electron main process
│   ├── preload.js          # Context bridge
│   └── package.json
├── shared/
│   └── constants.js        # Shared constants
└── package.json            # Root scripts
```

## LAN Setup

1. Start the backend on the server PC
2. Note the LAN IP printed in the console (e.g., `192.168.1.10`)
3. On other devices, open `http://192.168.1.10:5000` in a browser
4. For Electron clients, set `SERVER_URL=http://192.168.1.10:5000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| GET | /api/menu | Get menu items |
| POST | /api/orders | Create order |
| GET | /api/orders/active | Active orders |
| GET | /api/orders/kitchen | Kitchen orders |
| PATCH | /api/orders/:id/status | Update order status |
| PATCH | /api/orders/:id/item-status | Update item status |
| POST | /api/orders/:id/payment | Process payment |
| GET | /api/tables | Get all tables |
| GET | /api/tables/:id/qr | Generate QR code |
| GET | /api/reports/daily | Daily summary |
| GET | /api/reports/sales | Sales report |
| GET | /api/reports/tax | Tax report |
| POST | /api/external/simulate | Simulate external order |
| POST | /api/system/backup | Create backup |

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `order:new` | Server → All | New order created |
| `order:update` | Server → All | Order updated |
| `order:statusChange` | Server → All | Order status changed |
| `order:itemStatus` | Server → All | Item status changed |
| `kitchen:update` | Server → Kitchen | Kitchen display refresh |
| `table:update` | Server → All | Table status changed |
| `external:order` | Server → All | External order received |

## Production Build

```bash
# Build frontend
npm run build:frontend

# Start production server
npm run start:server

# Build Electron app
cd electron && npm run build
```

## License

MIT

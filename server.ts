import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Expense, ExpenseCategory, UserProfile, SavingsGoal, SavingsGoalCategory } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limits for receipt image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Database File Path
const DB_PATH = path.join(process.cwd(), "db_kosnomis.json");

// Define basic schema type
interface DbSchema {
  users: UserProfile[];
  expenses: Expense[];
  goals: SavingsGoal[];
}

// Initial Mock data for a fresh Indonesian boarding school student experience
const INITIAL_DB: DbSchema = {
  users: [

    {
      id: "default-anak-kos",
      name: "M.Rizki Pratama",
      monthlyAllowance: 500000, // Rp 500.000
      allowanceDay: 23,          // Receives monthly transfer on the 23rd
      avatarUrl: "/uploads/avatar-default-anak-kos-1779500991809.jpg",
      joinedAt: new Date().toISOString()
    }
  ],
  expenses: [
    {
      id: "exp-1",
      userId: "default-anak-kos",
      storeName: "Warmindo Berkah",
      totalAmount: 12000,
      category: "Makanan",
      items: ["Indomie Tante Double", "Es Teh Manis"],
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      note: "Makan malem darurat hemat",
      isAiScanned: false
    },
    {
      id: "exp-2",
      userId: "default-anak-kos",
      storeName: "Matahari Fotokopi",
      totalAmount: 15000,
      category: "Tugas/Kuliah",
      items: ["Print Laporan Praktikum", "Jilid Hardcover"],
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      note: "Print tugas fisika",
      isAiScanned: false
    },
    {
      id: "exp-3",
      userId: "default-anak-kos",
      storeName: "Boba Senyumin",
      totalAmount: 28000,
      category: "Hiburan",
      items: ["Brown Sugar Boba Milk Tea Large"],
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      note: "Khilaf pengen boba",
      isAiScanned: false
    },
    {
      id: "exp-4",
      userId: "default-anak-kos",
      storeName: "Ibu Kos Murah",
      totalAmount: 450000,
      category: "Kos/Utilitas",
      items: ["Iuran Bulanan Kos Kamar 12", "Listrik Bulanan"],
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      note: "Patungan listrik & kos bulanan",
      isAiScanned: false
    }
  ],
  goals: [
    {
      id: "goal-1",
      userId: "default-anak-kos",
      title: "Celengan Beli Sepatu Baru",
      targetAmount: 600000,
      currentAmount: 150000,
      category: "Fashion/Sepatu",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      targetMonths: 3
    },
    {
      id: "goal-2",
      userId: "default-anak-kos",
      title: "Dana Darurat Akhir Semester",
      targetAmount: 500000,
      currentAmount: 100000,
      category: "Dana Darurat",
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      targetMonths: 2
    }
  ]
};

// Database utility functions
function readDb(): DbSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DB, null, 2), "utf-8");
      return INITIAL_DB;
    }
    const data = fs.readFileSync(DB_PATH, "utf-8");
    const db: DbSchema = JSON.parse(data);
    if (!db.goals) {
      db.goals = [];
    }
    return db;
  } catch (error) {
    console.error("Gagal membaca atau menginisialisasi database:", error);
    // Ensure INITIAL_DB has goals
    if (!INITIAL_DB.goals) INITIAL_DB.goals = [];
    return INITIAL_DB;
  }
}

function writeDb(data: DbSchema) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Gagal menulis ke database:", error);
  }
}

// Helper function to calculate current date based on simulated time travel offset and client local time
function getSimulatedDate(req: any): Date {
  const simulatedDays = Number(req.headers["x-simulated-days"]) || 0;
  const clientYear = Number(req.headers["x-client-year"]);
  const clientMonth = Number(req.headers["x-client-month"]); // 0-11
  const clientDay = Number(req.headers["x-client-day"]); // 1-31
  const clientHours = Number(req.headers["x-client-hours"]);
  const clientMinutes = Number(req.headers["x-client-minutes"]);

  let baseDate: Date;
  if (!isNaN(clientYear) && !isNaN(clientMonth) && !isNaN(clientDay)) {
    // Reconstruct utilizing numbers that match the client's local calendar dates
    const hours = !isNaN(clientHours) ? clientHours : 12;
    const minutes = !isNaN(clientMinutes) ? clientMinutes : 0;
    baseDate = new Date(clientYear, clientMonth, clientDay, hours, minutes, 0);
  } else {
    baseDate = new Date();
  }

  if (simulatedDays !== 0) {
    return new Date(baseDate.getTime() + simulatedDays * 24 * 60 * 60 * 1000);
  }
  return baseDate;
}

// Inisialisasi Gemini API client
let aiInstance: GoogleGenAI | null = null;
let geminiCooldownUntil = 0;

function isGeminiRateLimited(): boolean {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "" || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    return true;
  }
  return Date.now() < geminiCooldownUntil;
}

function triggerGeminiCooldown() {
  geminiCooldownUntil = Date.now() + 5 * 60 * 1000; // 5 minute cooldown
  console.log("Gemini API is temporarily in cooling state.");
}

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "dummy-key",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiInstance;
}

// Helper to determine active user based on headers
function getActiveUserId(req: express.Request): string | null {
  const userId = req.headers["x-user-id"];
  return typeof userId === "string" && userId.trim() !== "" ? userId : null;
}

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. HEALTH AND TEST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", appName: "KosNomis Backend" });
});

// 2. AUTHENTICATION & PROFILE
app.post("/api/auth/register", (req, res) => {
  const { name, monthlyAllowance, allowanceDay } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Nama wajib diisi." });
  }

  const parsedAllowance = Number(monthlyAllowance);
  if (monthlyAllowance !== undefined && (isNaN(parsedAllowance) || parsedAllowance <= 0)) {
    return res.status(400).json({ error: "Uang saku bulanan harus berupa angka positif yang valid." });
  }

  const parsedDay = Number(allowanceDay);
  if (allowanceDay !== undefined && (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31)) {
    return res.status(400).json({ error: "Tanggal kiriman saku wajib berada di antara range 1 sampai 31." });
  }

  const db = readDb();
  const newUserId = "user-" + Date.now();
  const newUser: UserProfile = {
    id: newUserId,
    name: name,
    monthlyAllowance: isNaN(parsedAllowance) || parsedAllowance <= 0 ? 1500000 : parsedAllowance,
    allowanceDay: isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31 ? 5 : parsedDay,
    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
    joinedAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDb(db);
  res.status(201).json({ success: true, user: newUser });
});

app.post("/api/auth/login", (req, res) => {
  const { name } = req.body;
  const db = readDb();
  
  if (!name) {
    return res.status(400).json({ error: "Nama wajib diisi." });
  }

  // Find exact or dynamic match
  const user = db.users.find(u => u.name.toLowerCase().includes(name.toLowerCase()));
  if (user) {
    res.json({ success: true, user });
  } else {
    // Auto register if not found to accommodate simple UI login
    const newUserId = "user-" + Date.now();
    const newUser: UserProfile = {
      id: newUserId,
      name: name,
      monthlyAllowance: 1500000,
      allowanceDay: 5,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      joinedAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDb(db);
    res.json({ success: true, user: newUser, autoRegistered: true });
  }
});

app.get("/api/auth/me", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.json({ user: null });
  }
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    return res.json({ user: null });
  }
  res.json({ user });
});

app.post("/api/profile/update", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const { name, monthlyAllowance, allowanceDay, avatarUrl } = req.body;
  const db = readDb();
  
  const userIdx = db.users.findIndex(u => u.id === userId);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User tidak ditemukan." });
  }

  // Validate monthlyAllowance
  let parsedAllowance = db.users[userIdx].monthlyAllowance;
  if (monthlyAllowance !== undefined) {
    const num = Number(monthlyAllowance);
    if (!isNaN(num) && num > 0) {
      parsedAllowance = num;
    } else {
      return res.status(400).json({ error: "Uang saku bulanan harus berupa angka positif yang valid." });
    }
  }

  // Validate allowanceDay
  let parsedAllowanceDay = db.users[userIdx].allowanceDay;
  if (allowanceDay !== undefined) {
    const day = Number(allowanceDay);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      parsedAllowanceDay = day;
    } else {
      return res.status(400).json({ error: "Tanggal kiriman saku wajib berada di antara range 1 sampai 31." });
    }
  }

  db.users[userIdx] = {
    ...db.users[userIdx],
    name: name || db.users[userIdx].name,
    monthlyAllowance: parsedAllowance,
    allowanceDay: parsedAllowanceDay,
    avatarUrl: avatarUrl || db.users[userIdx].avatarUrl
  };

  writeDb(db);
  res.json({ success: true, user: db.users[userIdx] });
});

// POST to upload profile picture via base64 encoded string
app.post("/api/profile/upload-avatar", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const { dataUri } = req.body;
  
  if (!dataUri) {
    return res.status(400).json({ error: "Data gambar tidak ditemukan." });
  }

  // Parse mime and base64 data
  const matches = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return res.status(400).json({ error: "Format gambar tidak valid." });
  }

  const fileType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  // Determine file extension
  let extension = "png";
  if (fileType.includes("jpeg") || fileType.includes("jpg")) {
    extension = "jpg";
  } else if (fileType.includes("webp")) {
    extension = "webp";
  } else if (fileType.includes("gif")) {
    extension = "gif";
  }

  const fileName = `avatar-${userId}-${Date.now()}.${extension}`;
  const filePath = path.join(process.cwd(), "uploads", fileName);

  try {
    // Delete any old avatars for this user to save space
    const uploadsPath = path.join(process.cwd(), "uploads");
    if (fs.existsSync(uploadsPath)) {
      const files = fs.readdirSync(uploadsPath);
      for (const file of files) {
        if (file.startsWith(`avatar-${userId}-`)) {
          try {
            fs.unlinkSync(path.join(uploadsPath, file));
          } catch (e) {
            // ignore error during cleanup
          }
        }
      }
    }

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/${fileName}`;

    // Update the database profile immediately
    const db = readDb();
    const userIdx = db.users.findIndex(u => u.id === userId);
    if (userIdx !== -1) {
      db.users[userIdx].avatarUrl = publicUrl;
      writeDb(db);
      return res.json({ success: true, avatarUrl: publicUrl, user: db.users[userIdx] });
    }

    res.json({ success: true, avatarUrl: publicUrl });
  } catch (err: any) {
    console.error("Error saving avatar upload:", err);
    res.status(500).json({ error: "Gagal menyimpan file gambar profil." });
  }
});


// 3. EXPENSES CRUD
app.get("/api/expenses", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const db = readDb();
  
  const userExpenses = db.expenses
    .filter(e => e.userId === userId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  res.json({ expenses: userExpenses });
});

app.post("/api/expenses", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const { storeName, totalAmount, category, items, date, note, isAiScanned } = req.body;
  
  if (!storeName || !totalAmount || !category) {
    return res.status(400).json({ error: "Nama toko, total nominal, dan kategori wajib diisi." });
  }

  const parsedAmount = Number(totalAmount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "Nominal pengeluaran harus berupa angka positif yang valid." });
  }

  const db = readDb();
  const newExpense: Expense = {
    id: "exp-" + Date.now(),
    userId,
    storeName,
    totalAmount: parsedAmount,
    category: category as ExpenseCategory,
    items: Array.isArray(items) ? items : items ? [items] : [],
    date: date || getSimulatedDate(req).toISOString().split("T")[0],
    note: note || "",
    isAiScanned: isAiScanned === true
  };

  db.expenses.push(newExpense);
  writeDb(db);
  res.status(201).json({ success: true, expense: newExpense });
});

app.delete("/api/expenses/:id", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const { id } = req.params;
  const db = readDb();
  
  const originalLength = db.expenses.length;
  db.expenses = db.expenses.filter(e => !(e.id === id && e.userId === userId));
  
  if (db.expenses.length === originalLength) {
    return res.status(404).json({ error: "Pengeluaran tidak ditemukan atau Anda tidak memiliki akses." });
  }

  writeDb(db);
  res.json({ success: true, message: "Pengeluaran berhasil dihapus." });
});

app.post("/api/expenses/reset", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const db = readDb();
  
  db.expenses = db.expenses.filter(e => e.userId !== userId);
  if (db.goals) {
    db.goals = db.goals.filter(g => g.userId !== userId);
  }
  writeDb(db);
  res.json({ success: true, message: "Semua data pengeluaran dan celengan berhasil di-reset!" });
});

// 4. CELENGAN IMPIAN (SAVINGS & GOALS TRACKER) APIs
// GET all Savings Goals for active user
app.get("/api/savings", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const db = readDb();
  const goals = db.goals ? db.goals.filter(g => g.userId === userId) : [];
  res.json({ success: true, goals });
});

// POST to create a new Savings Goal
app.post("/api/savings", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const { title, targetAmount, category, targetMonths } = req.body;
  
  if (!title || !targetAmount || !category) {
    return res.status(400).json({ error: "Judul celengan, target uang, dan kategori wajib diisi." });
  }

  const parsedTarget = Number(targetAmount);
  if (isNaN(parsedTarget) || parsedTarget <= 0) {
    return res.status(400).json({ error: "Target nominal celengan harus berupa angka positif yang valid." });
  }

  const parsedMonths = Number(targetMonths);
  if (isNaN(parsedMonths) || parsedMonths <= 0) {
    return res.status(400).json({ error: "Jangka waktu (bulan) harus bernilai minimal 1." });
  }

  const db = readDb();
  const newGoal: SavingsGoal = {
    id: "goal-" + Date.now(),
    userId,
    title,
    targetAmount: parsedTarget,
    currentAmount: 0,
    category,
    createdAt: getSimulatedDate(req).toISOString(),
    targetMonths: parsedMonths
  };

  if (!db.goals) db.goals = [];
  db.goals.push(newGoal);
  writeDb(db);

  res.status(201).json({ success: true, goal: newGoal });
});

// POST to add/withdraw savings transaction on a goal
app.post("/api/savings/:id/transaction", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const { id } = req.params;
  const { amount, action } = req.body; // action: "save" | "withdraw"
  const parsedAmount = Number(amount);

  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "Nominal uang transaksi tidak valid." });
  }

  const db = readDb();
  if (!db.goals) db.goals = [];
  const goalIndex = db.goals.findIndex(g => g.id === id && g.userId === userId);
  
  if (goalIndex === -1) {
    return res.status(404).json({ error: "Celengan tidak ditemukan atau Anda tidak memiliki akses." });
  }

  const goal = db.goals[goalIndex];

  if (action === "save") {
    // Validate bounds
    if (goal.currentAmount >= goal.targetAmount) {
      return res.status(400).json({ error: "Sobat, celengan ini sudah terpenuhi!" });
    }

    if (goal.currentAmount + parsedAmount > goal.targetAmount) {
      return res.status(400).json({ error: `Nominal kebesaran! Cukup tabung Rp ${(goal.targetAmount - goal.currentAmount).toLocaleString("id-ID")} lagi.` });
    }

    // Save transaction
    goal.currentAmount += parsedAmount;
    
    // Add automatic expense so sisa saku automatically updates and stats reflect the saving
    const newExpense: Expense = {
      id: "exp-save-" + Date.now(),
      userId,
      storeName: `💰 Tabung: ${goal.title}`,
      totalAmount: parsedAmount,
      category: "Lainnya",
      items: ["Masukkan celengan impian"],
      date: getSimulatedDate(req).toISOString().split("T")[0],
      note: `Menyisihkan uang saku untuk target: ${goal.title}`,
      isAiScanned: false
    };
    db.expenses.push(newExpense);
    
  } else if (action === "withdraw") {
    // Withdraw money back to general wallet
    if (goal.currentAmount < parsedAmount) {
      return res.status(400).json({ error: "Saldo celengan tidak mencukupi untuk ditarik." });
    }
    goal.currentAmount -= parsedAmount;

    // Add negative expense to refund the wallet!
    const newExpense: Expense = {
      id: "exp-draw-" + Date.now(),
      userId,
      storeName: `💸 Ambil Celengan: ${goal.title}`,
      totalAmount: -parsedAmount, // Refund!
      category: "Lainnya",
      items: ["Tarik celengan ke dompet harian"],
      date: getSimulatedDate(req).toISOString().split("T")[0],
      note: `Gunakan uang simpanan dari celengan: ${goal.title}`,
      isAiScanned: false
    };
    db.expenses.push(newExpense);
  } else {
    return res.status(400).json({ error: "Aksi tidak dikenal (Gunakan save/withdraw)." });
  }

  writeDb(db);
  res.json({ success: true, goal, expenses: db.expenses.filter(e => e.userId === userId) });
});

// DELETE a savings goal
app.delete("/api/savings/:id", (req, res) => {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const { id } = req.params;
  const db = readDb();
  
  if (!db.goals) db.goals = [];
  const goal = db.goals.find(g => g.id === id && g.userId === userId);
  if (!goal) {
    return res.status(404).json({ error: "Celengan tidak ditemukan atau Anda tidak memiliki akses." });
  }

  // Return the saved money back into user's wallet
  if (goal.currentAmount > 0) {
    const refundExpense: Expense = {
      id: "exp-refund-" + Date.now(),
      userId,
      storeName: `💸 Pembubaran Celengan: ${goal.title}`,
      totalAmount: -goal.currentAmount,
      category: "Lainnya",
      items: ["Refund celengan dibubarkan"],
      date: getSimulatedDate(req).toISOString().split("T")[0],
      note: `Semua dana di celengan ${goal.title} dikembalikan ke dompet harian.`,
      isAiScanned: false
    };
    db.expenses.push(refundExpense);
  }

  db.goals = db.goals.filter(g => !(g.id === id && g.userId === userId));
  writeDb(db);
  res.json({ success: true, message: "Celengan berhasil dibubarkan!" });
});

// 5. HUMOROUS AI COACH LOCAL BACKUP GENERATOR & "MODE AKHIR BULAN"
function getLocalRoast(
  name: string,
  remainingBudget: number,
  daysUntilNextAllowance: number,
  allowanceDay: number,
  vibeStatus: "Aman" | "Waspada" | "Kritis",
  categoriesMap: Record<string, number>,
  goals: SavingsGoal[] = [],
  monthlyAllowance: number = 1000000
): string {
  let highestCategory = "";
  let highestAmount = 0;
  for (const [cat, amt] of Object.entries(categoriesMap)) {
    if (amt > highestAmount) {
      highestAmount = amt;
      highestCategory = cat;
    }
  }

  const roundedRemaining = Math.max(0, remainingBudget);
  const formattedRemaining = roundedRemaining.toLocaleString("id-ID");

  // Determine if there are mathematically absurd or impossible goals
  let goalRoastSentence = "";
  if (goals.length > 0) {
    const impossible = goals.find(g => {
      const remainingToSave = Math.max(0, g.targetAmount - g.currentAmount);
      const neededPerMonth = Math.ceil(remainingToSave / (g.targetMonths || 1));
      return neededPerMonth > monthlyAllowance || neededPerMonth > remainingBudget;
    });

    if (impossible) {
      const remainingToSave = Math.max(0, impossible.targetAmount - impossible.currentAmount);
      const neededPerMonth = Math.ceil(remainingToSave / (impossible.targetMonths || 1));
      if (neededPerMonth > monthlyAllowance) {
        goalRoastSentence = ` Lagian lu bikin celengan "${impossible.title}" butuh nabung Rp ${neededPerMonth.toLocaleString("id-ID")}/bulan, lah total uang jajan lu sebulan aja cuma Rp ${monthlyAllowance.toLocaleString("id-ID")}. Lu mau puasa tanpa sahur selamanya atau nunggu warisan mendadak, bro?!`;
      } else if (neededPerMonth > remainingBudget) {
        goalRoastSentence = ` Ditambah lagi halusinasi finansial celengan "${impossible.title}" yang butuh Rp ${neededPerMonth.toLocaleString("id-ID")}/bulan, sementara sisa saldo kantong lu detik ini cuma tinggal Rp ${formattedRemaining}. Matematika lu dapet nilai merah ya waktu SD? Mustahil terwujud!`;
      }
    }
  }

  if (vibeStatus === "Kritis") {
    const list = [
      `Aduh, ${name}! Dompet lu mangap parah sisa Rp ${formattedRemaining} buat ${daysUntilNextAllowance} hari lagi menuju tanggal ${allowanceDay}. ${
        highestCategory
          ? `Gara-gara lu kalap di kategori ${highestCategory} (Rp ${highestAmount.toLocaleString("id-ID")}),`
          : ""
      } lu kudu buru-buru puasa senin-kamis sukarela atau jatah makan mie instan dibagi dua pagi-sore. Stop kelakuan konsumtif lu sebelum pingsan di koridor kampus!${goalRoastSentence}`,
      `Innalillahi ${name}, sisa saldo Rp ${formattedRemaining} itu beneran mengenaskan buat bertahan ${daysUntilNextAllowance} hari. Ini bukan waspada bensin lagi, lu udah darurat butuh keajaiban khodam penarik rezeki. Kurangi gengsi, segera nebeng wifi kosan tetangga buat nonton mukbang biar kenyang bayangan!${goalRoastSentence}`,
      `Dear ${name}, mending lu tatap pintu kosan dalam-dalam. Rp ${formattedRemaining} buat sisa ${daysUntilNextAllowance} hari? Lu mau survive pake fotosintesis daun mangga apa gimana? Stop dulu jajan kopi estetik berkedok 'healing' padahal abis itu pala pusing mikirin besok makan apa!${goalRoastSentence}`,
      `Waduh ${name}, sisa budget lu tersisa Rp ${formattedRemaining}! ${
        highestCategory === "Makanan"
          ? "Lu makan apa aja sih ampe ludes begini? Ingat, lambung lu bukan aset investasi!"
          : highestCategory === "Hiburan"
          ? "Kalap nonton konser atau nongkrong mulu ya? Healing elit, bayar sewa kos pusing!"
          : "Kurangi pengeluaran dadakan yang gak penting!"
      } Siapkan diri lu berguru cara masak nasi Magic Com dicampur mie instan seleraku demi ketahanan pangan nasional.${goalRoastSentence}`
    ];
    return list[Math.floor(Math.random() * list.length)];
  }

  if (vibeStatus === "Waspada") {
    const list = [
      `Sisa dompet Rp ${formattedRemaining} untuk ${daysUntilNextAllowance} hari ke depan masih bisa diselamatkan kok, ${name}.${goalRoastSentence} Asal lu kagak gatel tangan buat checkout keranjang Shopee atau diajakin temen patungan seblak level 10. Stay humble, stay di kamar kos aja!`,
      `Eits ${name}! Status pertahanan keuanganmu sudah masuk zona WASPADA. Pengeluaran lu ${
        highestCategory ? `paling deras di ${highestCategory}` : "mulai tak terkontrol"
      }.${goalRoastSentence} Kurangi kebiasaan nongkrong sore berkedok 'senja romantis' yang aslinya bakar duit saku lu. Inget, kiriman ortu masih ${daysUntilNextAllowance} hari lagi!`,
      `Waspadalah! Tabungan sisa Rp ${formattedRemaining} sedang mengintai ketenangan tidurmu, ${name}.${goalRoastSentence} Jangan biarkan hasrat haus es boba menghancurkan sisa pertahanan ${daysUntilNextAllowance} hari ke depan. Cari warkop yang gratis air putih anget gih!`
    ];
    return list[Math.floor(Math.random() * list.length)];
  }

  // Vibe Status: Aman
  const list = [
    `Wih gayanya, status dompet masih AMAN (Sisa Rp ${formattedRemaining}), ${name}!${goalRoastSentence} Tapi jangan langsung sombong terus sok-sokan neraktir se-geng kosan ya bund. Perjalanan menuju tanggal ${allowanceDay} masih ada ${daysUntilNextAllowance} hari lagi, badai akhir bulan belum tentu bisa dilewati dengan senyuman!`,
    `Mantap jiwa ${name}! Sisa anggaran Rp ${formattedRemaining} tergolong sejuk kayak kipas angin kosan nomor 3.${goalRoastSentence} Jaga performa hemat ini, jangan tergiur promo diskon makanan ojek online yang aslinya jebakan batman!`,
    `Dompet lu aman damai sejahtera saat ini, ${name}.${goalRoastSentence} Tapi inget pepatah anak kosan purba: 'Sombong di tanggal muda, nangis berdarah di tanggal tua'. Tetap pantau pengeluaran harian biar tidurnya nyenyak!`
  ];
  return list[Math.floor(Math.random() * list.length)];
}

// Local Recipe Generator - Fallback for AI Chef
function getLocalRecipe(
  mode: "masak" | "jajan",
  ingredients: string[] = [],
  maxBudget: number = 15000,
  lifeStage: string = "Sederhana/Presisi"
) {
  const finalBudget = maxBudget || 15000;
  
  if (mode === "masak") {
    // 1. Clean and normalize ingredients list
    const validIngredients = (ingredients || [])
      .map(i => i.trim())
      .filter(i => i.length > 0);

    const ingsLower = validIngredients.map(i => i.toLowerCase());

    // If no ingredients are selected at all, give them a default
    if (validIngredients.length === 0) {
      return {
        recommendationType: "masak",
        title: "Nasi Kucing Keberuntungan Kosan",
        estimatedCost: 5000,
        difficultyOrSource: "Level Survival Dasar",
        ingredientsOrCombo: [
          "1 Piring Nasi Putih sisa (Rp 2.000)",
          "1 Sachet Kecap Manis Saset (Rp 1.500)",
          "Garam & Doa Restu Orang Tua (Rp 1.500)"
        ],
        stepsOrTactics: [
          "Ambil sisa nasi di rice cooker. Kalau sudah agak keras, percikkan sedikit air putih hangat.",
          "Tuangkan kecap manis sachet dengan gerakan estetis melingkar.",
          "Aduk sampai rata dan berdoa supaya bulan depan uang kiriman lancar jaya.",
          "Makanlah dengan perlahan agar kenyangnya bertahan lebih lama."
        ],
        funnySurvivalTip: "Makanlah di depan cermin sambil membayangkan Anda sedang bersantap malam romantis di Paris. Visualisasi adalah kunci kenyang sebelum waktunya!",
        description: "Sajian karbohidrat murni bercita rasa manis-asin sederhana yang mampu meredam keroncongan lambung di tanggal tua."
      };
    }

    // Standard items lookup table for pricing and description
    const ingredientPriceBook: Record<string, { label: string; price: number }> = {
      "telur": { label: "Butir Telur Ayam Ras", price: 2500 },
      "telor": { label: "Butir Telur Ayam Ras", price: 2500 },
      "mie instan": { label: "Bungkus Mie Instan Favorit", price: 3500 },
      "mie": { label: "Bungkus Mie Instan Favorit", price: 3500 },
      "instan": { label: "Bungkus Mie Instan", price: 3500 },
      "nasi": { label: "Piring Nasi Putih Sisa Semalam", price: 2000 },
      "bawang": { label: "Siung Bawang Merah & Putih Iris", price: 1000 },
      "cabai": { label: "Buah Cabai Rawit Setan Iris", price: 1050 },
      "cabe": { label: "Buah Cabai Rawit Setan Iris", price: 1050 },
      "kecap": { label: "Olesan Kecap Manis Gurih", price: 1000 },
      "sayur": { label: "Genggam Sayur Hijau Penolong Serat", price: 1500 },
      "tempe/tahu": { label: "Potong Tempe/Tahu Goreng Dadu", price: 2000 },
      "tempe": { label: "Potong Tempe Goreng Dadu", price: 2050 },
      "tahu": { label: "Potong Tahu Lembut Dadu", price: 1950 },
      "roti": { label: "Lembar Roti Tawar Sederhana", price: 3000 },
      "sosis": { label: "Batang Sosis Nikmat Iris Tebal", price: 3000 },
      "keju": { label: "Parutan Keju Sisa Kulkas Teman", price: 2500 },
      "susu": { label: "Sachet Susu Kental Manis Legit", price: 2000 }
    };

    // Build dynamic list of ingredients with pricing
    let estimatedCost = 0;
    const computedIngredients = validIngredients.map((ing) => {
      const lower = ing.toLowerCase();
      let label = `Porsi ${ing}`;
      let price = 2000; // Default price for custom ingredients

      // Check if standard ingredient exists
      if (ingredientPriceBook[lower]) {
        const item = ingredientPriceBook[lower];
        label = `${item.label}`;
        price = item.price;
      } else {
        // Custom ingredient pricing - let's make it look authentic! Set price by hash
        let hash = 0;
        for (let i = 0; i < lower.length; i++) {
          hash += lower.charCodeAt(i);
        }
        price = 2000 + (hash % 4) * 500; // Rp 2.000 to Rp 3.500
        label = `Bahan Tambahan: ${ing} (Pilihan Spesialmu)`;
      }

      estimatedCost += price;
      return `${ing} - sekitar Rp ${price.toLocaleString("id-ID")}`;
    });

    // Add cooking oil / seasoning default cost
    estimatedCost += 1000;
    computedIngredients.push(`Bumbu Penyedap & Minyak Goreng - Rp 1.000`);

    // Pick top ingredients to craft a gorgeous name
    const mainIngredient = validIngredients[0];
    const secondIngredient = validIngredients[1] || "";
    const thirdIngredient = validIngredients[2] || "";

    // Generate custom funny titles based on combinations of ingredients
    let title = "";
    let difficultyOrSource = "Level Pemula Rice Cooker";
    let funnySurvivalTip = "";
    let description = "";

    const randSuffix = [
      "No Debat",
      "Kere Hore",
      "Penyelamat Dompet",
      "Pemadam Kelaparan",
      "Sajian Senja Kosan",
      "Sultan Tanggal Tua",
      "Weton Kemakmuran",
      "Mahakarya Akhir Bulan"
    ];
    // Hash suffix based on first ingredient character code
    const suffixIndex = (mainIngredient.charCodeAt(0) || 0) % randSuffix.length;
    const suffixSelected = randSuffix[suffixIndex];

    if (ingsLower.includes("mie instan") || ingsLower.includes("mie")) {
      title = `Mie Instan Mewah Kreasi ${mainIngredient === "Mie Instan" || mainIngredient === "Mie" ? (secondIngredient || "Anak Rantau") : mainIngredient} ${suffixSelected}`;
      difficultyOrSource = "Level Ahli Kompor Satu Tungku";
      funnySurvivalTip = "Rebus mie jangan terlalu lembek, biar sensasi gigitannya berasa makan pasta Italia di restoran bintang lima.";
      description = `Olah kreasi mie instan dipadukan dengan kesegaran bumbu pelengkap dan kelezatan bahan ${validIngredients.join(" & ")}. Mengurangi beban batin di akhir semester secara instan!`;
    } else if (ingsLower.includes("nasi")) {
      title = `Nasi Goreng Penyelamat '${secondIngredient || "Polos"} ${mainIngredient}' ${suffixSelected}`;
      difficultyOrSource = "Level Jagoan Wajan Kosan";
      funnySurvivalTip = "Gunakan nasi yang agak dingin agar nasi gorengmu tidak lembek atau menggumpal seperti adonan donat gagal.";
      description = `Nasi goreng eksotis racikan mandiri dengan kolaborasi gurih dari bahan ${validIngredients.join(", ")}. Sangat harum, mengenyangkan, dan ramah kantong.`;
    } else if (ingsLower.includes("roti")) {
      title = `Roti Bakar Teflon Kombo '${secondIngredient || "Manis"} ${thirdIngredient || "Sederhana"}' ${suffixSelected}`;
      difficultyOrSource = "Level Pemula Wajan Teflon";
      funnySurvivalTip = "Panggang dengan api sekecil harapan cintamu padanya, agar roti tidak langsung gosong merana.";
      description = `Cemilan roti tawar panggang keemasan berisikan harmoni rasa manis gurih dari perpaduan bahan ${validIngredients.filter(x => x.toLowerCase() !== 'roti').join(" & ") || "margarin cair"}.`;
    } else if (ingsLower.includes("telur") || ingsLower.includes("telor")) {
      title = `Dadar Orak-Arik Kolaborasi '${secondIngredient || "Penyedap"} & ${thirdIngredient || "Seadanya"}'`;
      difficultyOrSource = "Level Masterchef Kos-Kosan";
      funnySurvivalTip = "Kocok telur sekuat tenaga sampai berbusa berkali-kali lipat agar mengembang tebal saat dituang ke penggorengan.";
      description = `Telur dadar campur orak-arik berongga gurih garing yang dimasak bersama ${validIngredients.filter(x => x.toLowerCase() !== 'telur').join(" dan ") || "bumbu micin pilihan"}.`;
    } else {
      // General custom ingredient generator
      title = `Tumis Sayur & ${mainIngredient} '${secondIngredient || "Gokil"}' ${suffixSelected}`;
      difficultyOrSource = "Level Survival Menengah";
      funnySurvivalTip = "Iris tipis-tipis semua bahan agar bumbu meresap sempurna dan santapan terlihat melimpah ruah di atas piring plastik.";
      description = `Tumisan kreatif yang menduetkan bahan utama ${validIngredients.join(" dengan ")} dibalut aroma bumbu tumis wangi penambah gairah hidup mahasiswa.`;
    }

    // Custom steps generation
    const stepsOrTactics = [
      `Siapkan dan cuci bersih semua bahan suci Anda: ${validIngredients.join(", ")}.`,
      `Potong atau iris tipis bahan ${validIngredients.slice(0, 3).join(", ")} untuk memaksimalkan volume tampilan di piring.`,
      `Panaskan minyak atau mentega secukupnya di dalam rice cooker (pilih mode Cook) atau wajan mini kosan Anda.`,
      ingsLower.includes("bawang") || ingsLower.includes("cabai")
        ? `Tumis irisan bawang dan cabai sampai mengeluarkan aroma harum semerbak yang bisa membuat tetangga sebelah kosan menelan ludah.`
        : `Masukkan bahan penyedap rasa dan bumbu dapur seadanya ke dalam minyak panas.`,
      `Masukkan bahan utama (${validIngredients.slice(0, 2).join(" & ")}) lalu aduk-aduk perlahan dengan penuh kasih sayang layaknya mengasuh adik sendiri.`,
      ingsLower.includes("telur") ? `Masukkan telur ayam lalu orak-arik cepat agar tercampur rata dan meresap ke bahan lainnya.` : `Tunggu sampai adonan matang sempurna, lalu koreksi rasa dengan sedikit garam atau kecap manis rasa surga.`,
      `Angkat dan sajikan selagi panas mengepul di atas piring kesayangan Anda.`
    ];

    // Clean step duplicates if any
    const finalSteps = [...new Set(stepsOrTactics)];

    // Force limit calculation adjustments to sound authentic
    if (estimatedCost > finalBudget) {
      estimatedCost = Math.max(5000, Math.floor(finalBudget * 0.85));
    }

    return {
      recommendationType: "masak",
      title: title,
      estimatedCost: Math.round(estimatedCost / 100) * 100, // Round to nearest 100 rupiah
      difficultyOrSource: difficultyOrSource,
      ingredientsOrCombo: computedIngredients,
      stepsOrTactics: finalSteps,
      funnySurvivalTip: funnySurvivalTip || "Gunakan piring berukuran kecil agar porsi makanan Anda terlihat menggunung megah layaknya tumpeng syukuran.",
      description: description
    };
  } else {
    // Mode is "jajan" (restaurant recommendations matching budget)
    let combo = {
      recommendationType: "jajan",
      title: "Paket Nasi Kucing Dobel Orek Burjo",
      estimatedCost: 10000,
      difficultyOrSource: "Burjo / Warmindo Kuningan",
      ingredientsOrCombo: [
        "Nasi Kucing isi sambal teri (Rp 4.000)",
        "Orek tempe manis gurih porsi penuh (Rp 3.500)",
        "Gorengan tempe mendoan anget 1 biji (Rp 1.500)",
        "Es Teh Manis atau Air Es Putih (Rp 1.000)"
      ],
      stepsOrTactics: [
        "Pilih Burjo langganan terdekat yang penjualnya ramah dipanggil 'Aa' atau 'Teteh'.",
        "Pesan Nasi Kucing satu porsi, lalu minta Aa burjo menambahkan orek tempe sisa di mangkok pajangan.",
        "Ambil tempe gorengan yang paling baru diangkat dari wajan biar dapet sensasi panas meriah.",
        "Duduk dekat dispenser atau kipas angin biar suasana makan terasa adem sejuk tanpa biaya."
      ],
      funnySurvivalTip: "Minta Aa Warmindo-nya siram kuah soto atau kuah kari instan di atas nasi kucingmu secara gratis. Bilang aja: 'Aa, numpang kuah dikit dong biar gak seret!'",
      description: "Perpaduan nasi bungkus mini beraroma teri sambal pedas, diringi orek tempe manis nan kriuk tempe gorengan burjo."
    };

    if (finalBudget < 7000) {
      combo = {
        recommendationType: "jajan",
        title: "Siasat Nasi Setengah Kuah Melimpah Warteg",
        estimatedCost: 5500,
        difficultyOrSource: "Warteg Bahari Langganan",
        ingredientsOrCombo: [
          "Porsi Nasi Setengah Mangkok (Rp 3.000)",
          "Kuah Gulai, kuah rendang, & kuah sayur sop dicampur (Rp 0 / Free)",
          "Gorengan bakwan/tempe penyet 1 biji dihancurkan (Rp 1.500)",
          "Sambal merah ulek warteg gratis (Rp 0 / Free)",
          "Kerupuk putih kaleng legendaris (Rp 1.000)"
        ],
        stepsOrTactics: [
          "Dekati etalase Warteg dengan senyuman paling ramah bersahaja layaknya caleg kampanye.",
          "Pesan: 'Bu, nasi setengah porsi aja di piring ya'.",
          "Taktik Inti: Lanjutkan dengan nada santai: 'Kuah gulai sama kuah rendangnya campur ya bu, agak banyakin hehe'.",
          "Ambil rontokan tepung sisa bumbu gorengan di dasar nampan, taburkan di atas nasi banjir kuah tersebut.",
          "Hancurkan gorengan bakwan di atasnya, makan perlahan layaknya menikmati kuliner premium."
        ],
        funnySurvivalTip: "Jangan pernah ragu minta kuah sayur melimpah. Di dunia Warteg, kuah adalah hak segala bangsa mahasiswa kosan!",
        description: "Sensasi hidangan 'Nasi Banjir' kaya rasa rempah rendang dan gulai gurih yang menghuni setiap butiran nasimu."
      };
    } else if (finalBudget >= 7000 && finalBudget < 12000) {
      combo = {
        recommendationType: "jajan",
        title: "Kombo Warteg Hemat Bergizi 'Duo Protein Nabati'",
        estimatedCost: 9500,
        difficultyOrSource: "Warteg Kharisma Agung",
        ingredientsOrCombo: [
          "Satu piring Nasi Putih penuh (Rp 4.000)",
          "Satu potong Tempe Orek basah bumbu kecap manis (Rp 2.000)",
          "Tumis Kangkung atau Sayur Toge segar (Rp 2.000)",
          "Tahu goreng isi atau tempe mendoan (Rp 1.500)",
          "Teh tawar anget berkharisma (Rp 0 / Free)"
        ],
        stepsOrTactics: [
          "Pesan nasi putih porsi penuh biar kenyang maksimal.",
          "Pilih sayur kangkung/toge ditaruh langsung di atas nasi agar bumbu kuahnya meresap gurih.",
          "Pilih tempe orek legendaris warteg sebagai lauk utama berprotein tinggi.",
          "Ambil teh tawar hangat gelas kaca gratisan di sudut meja kasir untuk menutup sesi makan malam dengan elegan."
        ],
        funnySurvivalTip: "Kalau sayurnya tinggal sedikit di wadah etalase, minta ibu warteg menuangkan sisa-sisa bumbunya. Di situ letak kenikmatan micin yang sesungguhnya!",
        description: "Kombo seimbang karbohidrat nasi putih, sayuran hijau kaya serat, dan tahu mendoan lembut yang sangat mengenyangkan."
      };
    } else if (finalBudget >= 12000) {
      combo = {
        recommendationType: "jajan",
        title: "Paket Sultan Warteg 'Telur Dadar Utuh Kuah Manja'",
        estimatedCost: 14000,
        difficultyOrSource: "Warteg Premium Kampus",
        ingredientsOrCombo: [
          "Satu piring Nasi Putih mengundung (Rp 4.000)",
          "Telur dadar warteg tebal bersarang utuh (Rp 5.000)",
          "Orek tempe krispi atau Sambal Kentang (Rp 2.500)",
          "Sayur Sop kuah bening segar (Rp 2.500)",
          "Es Teh Manis Penyejuk Jiwa raga (Rp 2.000, opsional)"
        ],
        stepsOrTactics: [
          "Pesan lauk favorit semua anak kosan: Telur Dadar Warteg yang digoreng tebal bersarang gurih.",
          "Minta ibu warteg menyiramkan kuah sop hangat langsung membanjiri pinggiran piring nasi.",
          "Tambahkan sedikit orek tempe kering manis gurih di sisi piring.",
          "Sebutkan total nominal di kasir dengan suara lantang penuh percaya diri menunjukkan kemakmuran finansial harianmu."
        ],
        funnySurvivalTip: "Belajar membelah telur dadar warteg menjadi dua bagian bersilang: simpan belahan kedua buat lauk makan sahur nanti malam di kosan!",
        description: "Kombinasi sultan berupa telur dadar goreng super tebal nan gurih asin diguyur kesegaran kuah sop bervitamin tinggi."
      };
    }

    if (combo.estimatedCost > finalBudget) {
      combo.estimatedCost = Math.max(5000, Math.floor(finalBudget * 0.9));
    }
    return combo;
  }
}

app.post("/api/ai/coach", async (req, res) => {
  const { user, expenses, goals } = req.body;
  if (!user) {
    return res.status(400).json({ error: "Missing user profile in request body." });
  }

  // Get current user expenses from request body
  const userExpenses = expenses || [];
  
  // Calculate simulated dates and cycle
  const now = getSimulatedDate(req);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Calculate days until next allowance
  const allowanceDay = user.allowanceDay;
  let nextAllowanceDate = new Date(currentYear, currentMonth, allowanceDay);
  if (now.getDate() >= allowanceDay) {
    nextAllowanceDate = new Date(currentYear, currentMonth + 1, allowanceDay);
  }
  const diffTime = nextAllowanceDate.getTime() - now.getTime();
  const daysUntilNextAllowance = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Calculate simulated cycle day progression
  let prevAllowanceDate = new Date(nextAllowanceDate);
  prevAllowanceDate.setMonth(nextAllowanceDate.getMonth() - 1);
  const totalCycleMs = nextAllowanceDate.getTime() - prevAllowanceDate.getTime();
  const totalCycleDays = Math.round(totalCycleMs / (1000 * 60 * 60 * 24));
  const currentCycleDay = Math.max(1, Math.min(totalCycleDays, totalCycleDays - daysUntilNextAllowance + 1));

  // Filter expenses strictly belonging to the current allowance cycle
  const toISODateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const prevAllowanceStr = toISODateString(prevAllowanceDate);
  const nextAllowanceStr = toISODateString(nextAllowanceDate);

  const thisMonthExpenses = userExpenses.filter(e => {
    return e.date >= prevAllowanceStr && e.date < nextAllowanceStr;
  });

  const totalSpentThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
  const remainingBudget = user.monthlyAllowance - totalSpentThisMonth;

  // Calculate limits & status
  const originalDailyBudget = user.monthlyAllowance / 30;
  const safeDailyRemaining = remainingBudget / daysUntilNextAllowance;
  
  let vibeStatus: "Aman" | "Waspada" | "Kritis" = "Aman";
  if (remainingBudget <= 0) {
    vibeStatus = "Kritis";
  } else {
    const ratio = safeDailyRemaining / originalDailyBudget;
    if (ratio >= 0.85) {
      vibeStatus = "Aman";
    } else if (ratio >= 0.4) {
      vibeStatus = "Waspada";
    } else {
      vibeStatus = "Kritis";
    }
  }

  // Summarize category totals for the AI's contextual roast
  const categoriesMap: Record<string, number> = {};
  thisMonthExpenses.forEach(e => {
    categoriesMap[e.category] = (categoriesMap[e.category] || 0) + e.totalAmount;
  });
  
  const categoryRoastData = Object.entries(categoriesMap)
    .map(([cat, amount]) => `- ${cat}: Rp ${amount.toLocaleString("id-ID")}`)
    .join("\n");

  const dailyBudgetLimit = Math.max(0, Math.floor(safeDailyRemaining));

  // 1. Fetch real savings goals from body payload
  const userGoals = goals || [];

  // If Gemini API is actively in cooldown, shortcut straight to local roast to avoid quota errors and noise
  if (isGeminiRateLimited()) {
    console.log(`[Bypass] Gemini is on quota cooldown. Serving high-fidelity local roast for ${user.name}`);
    const fallbackMsg = getLocalRoast(
      user.name,
      remainingBudget,
      daysUntilNextAllowance,
      allowanceDay,
      vibeStatus,
      categoriesMap,
      userGoals,
      user.monthlyAllowance
    );
    return res.json({
      remainingBudget,
      totalExpenses: totalSpentThisMonth,
      daysUntilNextAllowance,
      dailyBudgetLimit,
      vibeStatus,
      vibeMessage: fallbackMsg,
      currentCycleDay
    });
  }

  try {
    const ai = getGeminiClient();
    
    // 2. Mathematically analyze savings goal feasibility
    let goalsSummaryData = "";
    if (userGoals.length === 0) {
      goalsSummaryData = "Mahasiswa ini BELUM punya Celengan Impian untuk menabung. Sindir mengapa mereka belum merancang masa depan dan dorong mereka untuk membuat Celengan Impian (seperti beli gadget, sepatu, liburan, atau dana darurat) daripada membuang seluruh uang sakunya begitu saja.";
    } else {
      const goalsAnalysis = userGoals.map(g => {
        const remainingToSave = Math.max(0, g.targetAmount - g.currentAmount);
        const targetMonths = g.targetMonths || 1;
        const monthlyNeeded = Math.ceil(remainingToSave / targetMonths);
        
        // Impossible status rules:
        // Case A: target amount per month is higher than current total monthly allowance
        const isAllowanceAbsurdlyLow = monthlyNeeded > user.monthlyAllowance;
        // Case B: target amount per month is higher than remaining budget this month
        const isBudgetTooLowThisMonth = monthlyNeeded > remainingBudget;
        
        // Let's also include absolute math bounds in goalsSummaryData to force Gemini model to generate a precise response
        let feasibilityStatus = "";
        if (isAllowanceAbsurdlyLow) {
          feasibilityStatus = `⚠️ KEMUSTAHILAN ABSOLUT (MATEMATIKA MUSTAHIL): Butuh menabag Rp ${monthlyNeeded.toLocaleString("id-ID")}/bulan, padahal total uang saku sebulan penuh cuma Rp ${user.monthlyAllowance.toLocaleString("id-ID")}! Ini mutlak mustahil dicapai walau kiamat tiba. Silakan julidin habis-habisan!`;
        } else if (isBudgetTooLowThisMonth) {
          feasibilityStatus = `⚠️ KETIDAKMUNGKINAN BULAN INI (HALUSINASI FINANSIAL): Butuh menabung Rp ${monthlyNeeded.toLocaleString("id-ID")}/bulan, sedangkan sisa uang saku bulan ini tinggal Rp ${remainingBudget.toLocaleString("id-ID")}! Target ini mustahil dicapai bulan ini, silakan sindir halusinasi keuangan ini secara tajam.`;
        } else {
          feasibilityStatus = `✅ LAYAK & AMAN: Butuh Rp ${monthlyNeeded.toLocaleString("id-ID")}/bulan, masih masuk akal dibanding sisa dana sekarang Rp ${remainingBudget.toLocaleString("id-ID")}.`;
        }

        return `- Judul Impian: "${g.title}"
  * Kategori: ${g.category}
  * Target Biaya: Rp ${g.targetAmount.toLocaleString("id-ID")} (Terkumpul: Rp ${g.currentAmount.toLocaleString("id-ID")}, Sisa: Rp ${remainingToSave.toLocaleString("id-ID")})
  * Target Waktu: ${targetMonths} Bulan (Butuh Rp ${monthlyNeeded.toLocaleString("id-ID")}/bulan)
  * Status Evaluasi Matematika: ${feasibilityStatus}`;
      });

      goalsSummaryData = `Berikut adalah Celengan Impian (Saving Goals) aktif mahasiswa saat ini:\n` + goalsAnalysis.join("\n\n");
    }
    
    const contextPrompt = `Berikan nasihat keuangan bulanan sarkas, kocak, mendidik, dengan bahasa gaul anak kosan Indonesia (slang gaul/Jakarta) berdasarkan data keuangan riil berikut:
- Nama Mahasiswa: ${user.name}
- Total Uang Saku Bulanan: Rp ${user.monthlyAllowance.toLocaleString("id-ID")}
- Total Pengeluaran Bulan Ini: Rp ${totalSpentThisMonth.toLocaleString("id-ID")}
- Sisa Saldo Sekarang: Rp ${remainingBudget.toLocaleString("id-ID")}
- Sisa Hari Menuju Transferan Berikutnya: ${daysUntilNextAllowance} hari lagi (tanggal ${allowanceDay})
- Limit Anggaran Harian yang Aman Sekarang: Rp ${dailyBudgetLimit.toLocaleString("id-ID")} per hari
- Status Vibe Finansial Saat Ini: **${vibeStatus}**

Pengeluaran Berdasarkan Kategori:
${categoryRoastData || "Belum ada pengeluaran dicatat bulan ini."}

Celengan Impian & Analisis Kelayakan Matematika:
${goalsSummaryData}

INSTRUKSI COCHING LEBIH PINTAR & AKURAT (MAKSIMALKAN MATEMATIKA):
1. JANGAN PERNAH memberikan saran template generik! Lakukan perhitungan & analisis korelasi matematika nyata antara sisa uang saku sekarang, total pemasukan, dan kebutuhan cicilan celengan bulanan mereka.
2. Jika ada Celengan Impian yang terdeteksi "KEMUSTAHILAN ABSOLUT" atau "KETIDAKMUNGKINAN BULAN INI", Anda wajib menceramahi/menegur mahasiswa tersebut tentang kelayakan ekonominya yang kacau ini secara tajam, logis, tapi tetap menghibur dan bikin tertawa getir! Sebutkan nama barang impian yang tidak realistis itu (misalnya: "Mimpi beli '${userGoals[0]?.title || ""}' tapi sisa uang jajan cuma cukup buat parkir sekali").
3. Berikan saran realistis tentang bagaimana mereka bisa menghemat anggaran, memangkas pengeluaran berlebih mereka (sesuaikan dengan pengeluaran kategori terbesar di atas), atau memperpanjang jangka waktu celengan agar masuk akal sehat.
4. Buat respons yang sangat menghibur, dramatis khas drama anak kos Indonesia, namun tetap membawa kesadaran finansial yang edukatif dalam 4-5 kalimat yang bertenaga pukat harimau!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contextPrompt,
      config: {
        systemInstruction: "Kamu adalah AI 'KosNomis Coach' yang super sarkas, julid, tapi penyayang. Kamu selalu memanggil maba/mahasiswa dengan sebutan akrab/gaul seperti 'Bro', 'Sobat Kosan', 'Anak Muda', 'Bund', atau 'Wak'. Selalu gunakan slang bahasa Indonesia masa kini (seperti nangis berjamaah, menderita di akhir bulan, healing elite bayar pusing, dll). Responsmu harus murni berbentuk teks paragraf santai (bukan JSON atau list kaku)."
      }
    });

    const adviceText = response.text || "Aman lancar jaya bro! Tapi tetep hemat ya biar gak nangis di pojokan ntar.";

    res.json({
      remainingBudget,
      totalExpenses: totalSpentThisMonth,
      daysUntilNextAllowance,
      dailyBudgetLimit,
      vibeStatus,
      vibeMessage: adviceText,
      currentCycleDay
    });
  } catch (error: any) {
    const errorStr = (String(error?.message || "") + String(error?.status || "") + JSON.stringify(error || "")).toLowerCase();
    const isRateLimit = errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("limit") || errorStr.includes("err_blocked_by_client") || errorStr.includes("exhausted") || errorStr.includes("api_key") || errorStr.includes("status_code: 4");
    
    if (isRateLimit) {
      triggerGeminiCooldown();
      console.log("[Gemini Fallback] Gemini Coach rate limit, quota exceeded, or key is missing. Serving local fallback advice.");
    } else {
      console.log(`[Gemini Handled] Coach error: ${error?.message || error}`);
    }
    
    const fallbackMsg = getLocalRoast(
      user.name,
      remainingBudget,
      daysUntilNextAllowance,
      allowanceDay,
      vibeStatus,
      categoriesMap,
      userGoals,
      user.monthlyAllowance
    );

    res.json({
      remainingBudget,
      totalExpenses: totalSpentThisMonth,
      daysUntilNextAllowance,
      dailyBudgetLimit: Math.max(0, Math.floor(safeDailyRemaining)),
      vibeStatus,
      vibeMessage: fallbackMsg,
      currentCycleDay
    });
  }
});


// ==========================================
// CLIENT ENVIRONMENT INTEGRATION (Vite/SPA)
// ==========================================

async function startServer() {
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploads statically
  app.use("/uploads", express.static(uploadsDir));

  // Vite integration for rich local preview and building
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static builds
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 KosNomis fullstack app running on transport layer port: ${PORT}`);
    console.log(`✨ Open your developer preview to view the live interface!`);
  });
}

startServer();

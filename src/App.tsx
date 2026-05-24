import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  PiggyBank,
  Camera, 
  UploadCloud, 
  Share2, 
  Receipt, 
  Calendar, 
  DollarSign, 
  RefreshCw, 
  User, 
  Settings, 
  AlertTriangle, 
  CheckCircle2, 
  Wallet, 
  LogOut, 
  Copy, 
  Sparkles,
  ArrowRight,
  TrendingDown,
  Coins,
  Smile,
  Frown,
  Meh,
  Activity,
  HeartCrack,
  Info,
  ShoppingBag,
  Utensils
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Expense, ExpenseCategory, FinancialStats, UserProfile, SavingsGoal, SavingsGoalCategory } from "./types";
import { auth, db, googleProvider, OperationType, handleFirestoreError } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from "firebase/firestore";

// Infinitely scalable and crisp SVG Vector Logo representing "Kos" (graduation/boarding hat) and "Nomis" (glowing economic coin)
export function KosNomisLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="60%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <filter id="logoGlow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <circle cx="50" cy="50" r="44" stroke="url(#logoGrad)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
      <circle cx="50" cy="50" r="39" fill="#0B0F19" fillOpacity="0.85" stroke="url(#logoGrad)" strokeWidth="2.5" />

      {/* Graduation Cap */}
      <path 
        d="M50 21 L76 33 L50 45 L24 33 Z" 
        fill="url(#logoGrad)" 
        opacity="0.95"
      />
      <path 
        d="M34 38.5 V48 C34 54 41 58 50 58 C59 58 66 54 66 48 V38.5" 
        stroke="url(#logoGrad)" 
        strokeWidth="3.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M68 35.5 V46 C68 47.5 70 49 70 51" 
        stroke="#FBBF24" 
        strokeWidth="2.2" 
        strokeLinecap="round" 
      />

      {/* Golden Glowing Coin */}
      <g filter="url(#logoGlow)">
        <circle cx="50" cy="56" r="14.5" fill="url(#coinGrad)" stroke="#FFFFFF" strokeWidth="1.5" />
        <text 
          x="50" 
          y="60.5" 
          fill="#0B0F19" 
          fontSize="11.5" 
          fontWeight="900" 
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
          textAnchor="middle"
        >
          Rp
        </text>
      </g>

      {/* Elegant sparkles */}
      <path d="M78 19 L79.5 21.5 L82 21.5 L80 23 L80.5 25.5 L78 24 L75.5 25.5 L76 23 L74 21.5 L76.5 21.5 Z" fill="#FBBF24" />
      <path d="M22 65 L23 67 L25 67 L23.5 68.2 L24 70.2 L22 69 L20 70.2 L20.5 68.2 L19 67 L21 67 Z" fill="#818CF8" />
    </svg>
  );
}

export default function App() {
  // Authentication & Profile States
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authName, setAuthName] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAllowance, setEditAllowance] = useState<number | "">(1500000);
  const [editAllowanceDay, setEditAllowanceDay] = useState<number | "">(5);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Expense List & Form
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const budgetTableContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollTableBottom = () => {
    if (budgetTableContainerRef.current) {
      budgetTableContainerRef.current.scrollTo({
        top: budgetTableContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  const handleScrollTableTop = () => {
    if (budgetTableContainerRef.current) {
      budgetTableContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  };

  // Confirmation Modal States
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deleteGoalObj, setDeleteGoalObj] = useState<SavingsGoal | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [manualStoreName, setManualStoreName] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState<ExpenseCategory>("Makanan");
  const [manualItems, setManualItems] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>("Semua");

  // Celengan Impian States
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalMonths, setNewGoalMonths] = useState<string>("1");
  const [newGoalCategory, setNewGoalCategory] = useState<SavingsGoalCategory>("Dana Darurat");
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<SavingsGoal | null>(null);
  const [goalActionType, setGoalActionType] = useState<"save" | "withdraw" | null>(null);
  const [goalActionAmount, setGoalActionAmount] = useState("");
  const [isSavingsLoading, setIsSavingsLoading] = useState(false);

  // AI Financial Coach
  const [simulatedDays, setSimulatedDays] = useState<number>(() => {
    return Number(localStorage.getItem("kosnomis_simulated_days") || "0");
  });
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  const updateSimulatedDays = (days: number) => {
    const val = Math.max(0, days);
    setSimulatedDays(val);
    localStorage.setItem("kosnomis_simulated_days", String(val));
    if (val === 0) {
      showToast("Mesin Waktu di-reset ke Hari Ini!", "success");
    } else {
      showToast(`Mesin Waktu KosNomis: Bergeser +${val} Hari ke masa depan! 🚀`, "info");
    }
  };

  const getSimulatedDateLabel = () => {
    const simDate = new Date(Date.now() + simulatedDays * 24 * 60 * 60 * 1000);
    const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    const dateStr = simDate.toLocaleDateString("id-ID", options);
    return `${dateStr} (${simulatedDays === 0 ? "Hari Ini" : `+${simulatedDays} Hari`})`;
  };

  const getSimulatedCycleDetails = () => {
    if (!user) return { currentCycleDay: 1, daysUntilNextAllowance: 30 };
    
    const now = new Date(Date.now() + simulatedDays * 24 * 60 * 60 * 1000);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const allowanceDay = user.allowanceDay;

    let nextAllowanceDate = new Date(currentYear, currentMonth, allowanceDay);
    if (now.getDate() >= allowanceDay) {
      nextAllowanceDate = new Date(currentYear, currentMonth + 1, allowanceDay);
    }

    const diffTime = nextAllowanceDate.getTime() - now.getTime();
    const daysUntilNextAllowance = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    let prevAllowanceDate = new Date(nextAllowanceDate);
    prevAllowanceDate.setMonth(nextAllowanceDate.getMonth() - 1);
    const totalCycleMs = nextAllowanceDate.getTime() - prevAllowanceDate.getTime();
    const totalCycleDays = Math.round(totalCycleMs / (1000 * 60 * 60 * 24));

    const currentCycleDay = Math.max(1, Math.min(totalCycleDays, totalCycleDays - daysUntilNextAllowance + 1));

    return { currentCycleDay, daysUntilNextAllowance };
  };

  const getSimulatedISODateStr = () => {
    const d = new Date(Date.now() + simulatedDays * 24 * 60 * 60 * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getClientCalculatedStats = () => {
    if (!user) {
      return {
        totalExpenses: 0,
        remainingBudget: 0,
        dailyBudgetLimit: 0,
        progressPercent: 0
      };
    }

    const { currentCycleDay, daysUntilNextAllowance } = getSimulatedCycleDetails();
    
    // Calculate current cycle dates for client calculation
    const now = new Date(Date.now() + simulatedDays * 24 * 60 * 60 * 1000);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const allowanceDay = user.allowanceDay;

    let nextAllowanceDate = new Date(currentYear, currentMonth, allowanceDay);
    if (now.getDate() >= allowanceDay) {
      nextAllowanceDate = new Date(currentYear, currentMonth + 1, allowanceDay);
    }
    let prevAllowanceDate = new Date(nextAllowanceDate);
    prevAllowanceDate.setMonth(nextAllowanceDate.getMonth() - 1);

    const toISODateString = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const prevAllowanceStr = toISODateString(prevAllowanceDate);
    const nextAllowanceStr = toISODateString(nextAllowanceDate);

    // Filter relevant expenses for current cycle
    const currentCycleExpenses = expenses.filter(e => {
      return e.date >= prevAllowanceStr && e.date < nextAllowanceStr;
    });

    const totalExpenses = currentCycleExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
    const remainingBudget = user.monthlyAllowance - totalExpenses;
    const dailyBudgetLimit = Math.max(0, Math.floor(remainingBudget / daysUntilNextAllowance));
    const progressPercent = Math.min(100, Math.round((totalExpenses / user.monthlyAllowance) * 100));

    return {
      totalExpenses,
      remainingBudget,
      dailyBudgetLimit,
      progressPercent
    };
  };

  const clientStats = getClientCalculatedStats();

  const getClientDateHeaders = () => {
    const localDate = new Date();
    return {
      "x-client-year": String(localDate.getFullYear()),
      "x-client-month": String(localDate.getMonth()),
      "x-client-day": String(localDate.getDate()),
      "x-client-hours": String(localDate.getHours()),
      "x-client-minutes": String(localDate.getMinutes())
    };
  };

  // WhatsApp Split Bill
  const [splitTotal, setSplitTotal] = useState("");
  const [splitPeople, setSplitPeople] = useState("3");
  const [splitNote, setSplitNote] = useState("");
  const [transferDetails, setTransferDetails] = useState("");
  const [generatedWaText, setGeneratedWaText] = useState("");
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  interface SplitFriend {
    name: string;
    phone: string;
  }
  const [splitFriends, setSplitFriends] = useState<SplitFriend[]>([
    { name: "Teman 1", phone: "" },
    { name: "Teman 2", phone: "" },
  ]);

  // Sync splitFriends array size with splitPeople (excluding the user themselves)
  useEffect(() => {
    const peopleCount = Number(splitPeople);
    if (isNaN(peopleCount) || peopleCount <= 1) {
      setSplitFriends([]);
      return;
    }
    const friendsCount = peopleCount - 1;
    setSplitFriends((prev) => {
      const updated = [...prev];
      if (updated.length < friendsCount) {
        for (let i = updated.length; i < friendsCount; i++) {
          updated.push({ name: `Teman ${i + 1}`, phone: "" });
        }
      } else if (updated.length > friendsCount) {
        updated.splice(friendsCount);
      }
      return updated;
    });
  }, [splitPeople]);

  const formatWhatsAppPhone = (phone: string): string => {
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.slice(1);
    } else if (cleaned.startsWith("8")) {
      cleaned = "62" + cleaned;
    }
    return cleaned;
  };

  const getDirectWaUrl = (friend: SplitFriend) => {
    const perPerson = Math.round(Number(splitTotal) / Number(splitPeople));
    const formattedPerPerson = perPerson.toLocaleString("id-ID");
    const formattedTotal = Number(splitTotal).toLocaleString("id-ID");

    const message = `Halo ${friend.name}! 👋\n\n` +
      `Ini rincian patungan kita ${splitNote ? `buat *"${splitNote}"*` : "kemarin"} ya:\n` +
      `• Total Nota: Rp ${formattedTotal}\n` +
      `• Dibagi: ${splitPeople} orang\n` +
      `• Bagianmu: *Rp ${formattedPerPerson}*\n\n` +
      (transferDetails ? `Monggo langsung ditransfer via:\n👉 *${transferDetails}*\n\n` : `Bisa ditransfer ke Rekening/E-Wallet biasanya ya.\n\n`) +
      `_Ditunggu ya, makasih banyak sobat hemat!_ 💸`;

    const cleanPhone = formatWhatsAppPhone(friend.phone);
    if (cleanPhone) {
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  };

  const getGeneralWaUrl = () => {
    if (!generatedWaText) return "#";
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(generatedWaText)}`;
  };

  // General Notification Alert
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Helper Custom Toast
  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper Safe JSON parser to handle container spins or reverse proxy defaults gracefully
  const safeParseJson = async (res: Response): Promise<any> => {
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      const textTrim = text.trim();
      if (textTrim.startsWith("<!doctype") || textTrim.startsWith("<html") || textTrim.toLowerCase().includes("<!doctype html>")) {
        throw new Error("Layanan sedang memuat ulang. Silakan tunggu beberapa detik dan coba lagi!");
      }
      throw new Error("Respons dari server bukan berformat JSON.");
    }
    return res.json();
  };

  // Firebase Authentication listener on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const profile = userSnap.data() as UserProfile;
            setUser(profile);
            setEditName(profile.name);
            setEditAllowance(profile.monthlyAllowance);
            setEditAllowanceDay(profile.allowanceDay);
          } else {
            // First time login with Google: create secure profile
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "Anak Kos Hemat",
              monthlyAllowance: 1500000,
              allowanceDay: 5,
              avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`,
              joinedAt: new Date().toISOString()
            };
            await setDoc(userRef, newProfile);
            setUser(newProfile);
            setEditName(newProfile.name);
            setEditAllowance(newProfile.monthlyAllowance);
            setEditAllowanceDay(newProfile.allowanceDay);
            showToast(`Selamat datang ${newProfile.name}! Let's be KosNomis. ✨`, "success");
          }
        } catch (err: any) {
          console.error("Error loading user profile:", err);
          showToast("Gagal memuat profil dari database cloud", "error");
        }
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch expenses and goals when user state is active or simulated days change
  useEffect(() => {
    if (user) {
      fetchExpenses();
      fetchGoals();
    }
  }, [user, simulatedDays]);

  // Fetch coach stats with debounce when user, expenses, or goals change
  useEffect(() => {
    if (user && expenses !== undefined && goals !== undefined) {
      const debouncer = setTimeout(() => {
        fetchCoachStats();
      }, 600);
      return () => clearTimeout(debouncer);
    }
  }, [user, expenses, goals, simulatedDays]);

  const fetchExpenses = async () => {
    if (!user) return;
    try {
      const expensesRef = collection(db, "expenses");
      const q = query(expensesRef, where("userId", "==", user.id));
      const querySnapshot = await getDocs(q);
      const fetchedExpenses: Expense[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedExpenses.push({ id: docSnap.id, ...docSnap.data() } as Expense);
      });
      // Sort expenses by date descending
      fetchedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(fetchedExpenses);
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      handleFirestoreError(err, OperationType.LIST, "expenses");
    }
  };

  const fetchCoachStats = async () => {
    if (!user) return;
    setIsCoachLoading(true);
    try {
      // POST stats payload securely to express endpoint without backend DB dependence
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-simulated-days": String(simulatedDays),
          ...getClientDateHeaders()
        },
        body: JSON.stringify({
          user,
          expenses,
          goals
        })
      });
      const data = await safeParseJson(res);
      if (data && !data.error) {
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCoachLoading(false);
    }
  };

  // Auth login with Google
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        showToast("Masuk dibatalkan karena jendela Google ditutup.", "info");
      } else {
        showToast(`Gagal masuk dengan Google: ${err.message}`, "error");
      }
      setIsAuthLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!editName.trim()) {
      showToast("Nama panggilan tidak boleh kosong!", "error");
      return;
    }
    const allowanceNum = Number(editAllowance);
    if (isNaN(allowanceNum) || allowanceNum <= 0) {
      showToast("Uang saku bulanan harus berupa angka positif yang valid!", "error");
      return;
    }
    const dayNum = Number(editAllowanceDay);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      showToast("Tanggal kiriman saku wajib antara 1 hingga 31!", "error");
      return;
    }

    try {
      const userRef = doc(db, "users", user.id);
      const updatedData = {
        name: editName,
        monthlyAllowance: allowanceNum,
        allowanceDay: dayNum
      };
      await updateDoc(userRef, updatedData);
      
      setUser((prev) => prev ? { ...prev, ...updatedData } : null);
      setShowProfileEdit(false);
      showToast("Profil keuanganmu sukses di-update!", "success");
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar!", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran gambar maksimal 5MB!", "error");
      return;
    }

    setIsUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUri = e.target?.result;
      if (typeof dataUri !== "string") {
        showToast("Gagal membaca file gambar", "error");
        setIsUploadingAvatar(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, { avatarUrl: dataUri });
        
        setUser((prev) => prev ? { ...prev, avatarUrl: dataUri } : null);
        showToast("Foto profil berhasil di-upload!", "success");
      } catch (err: any) {
        console.error(err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
      } finally {
        setIsUploadingAvatar(false);
      }
    };
    reader.onerror = () => {
      showToast("Gagal membaca file gambar", "error");
      setIsUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      showToast("Berhasil logout. Jangan khilaf jajan! 👋");
    } catch (err: any) {
      showToast(`Gagal logout: ${err.message}`, "error");
    }
  };

  // Add Manual Expense with Firestore
  const handleAddManualExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!manualStoreName || !manualAmount) {
      showToast("Isi nama merchant dan nominal pengeluaran dulu!", "error");
      return;
    }

    const itemsArray = manualItems ? manualItems.split(",").map(i => i.trim()).filter(Boolean) : [];
    const dateStr = getSimulatedISODateStr();

    const newExpenseId = "exp-" + Math.random().toString(36).substring(2, 15);
    const newExpense: Expense = {
      id: newExpenseId,
      userId: user.id,
      storeName: manualStoreName,
      totalAmount: Number(manualAmount),
      category: manualCategory,
      items: itemsArray,
      date: dateStr,
      note: manualNote,
      isAiScanned: false
    };

    try {
      const expDocRef = doc(db, "expenses", newExpenseId);
      await setDoc(expDocRef, newExpense);
      
      showToast("Pengeluaran dicatat secara aman!", "success");
      setManualStoreName("");
      setManualAmount("");
      setManualItems("");
      setManualNote("");
      
      // Update local expenses state immediately
      setExpenses((prev) => [newExpense, ...prev]);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, `expenses/${newExpenseId}`);
    }
  };

  // Delete Expense with Firestore
  const handleDeleteExpense = async (id: string) => {
    if (!user) return;
    const targetExp = expenses.find(e => e.id === id);
    try {
      if (targetExp && targetExp.goalId) {
        const goalId = targetExp.goalId;
        const goalRef = doc(db, "goals", goalId);
        const goalDoc = await getDoc(goalRef);
        if (goalDoc.exists()) {
          const currentGoalData = goalDoc.data();
          const currentGoalAmount = currentGoalData.currentAmount || 0;
          // Revert the action:
          // If saved (positive totalAmount), we subtract it. If withdrawn (negative totalAmount), we add it back.
          const newAmount = Math.max(0, currentGoalAmount - targetExp.totalAmount);
          await updateDoc(goalRef, { currentAmount: newAmount });
          
          setGoals((prev) => prev.map(g => g.id === goalId ? { ...g, currentAmount: newAmount } : g));
          showToast(`Celengan "${currentGoalData.title || "Impian"}" disinkronkan kembali karena riwayat transaksinya dihapus!`, "info");
        }
      }

      await deleteDoc(doc(db, "expenses", id));
      showToast("Catatan berhasil dihapus.", "success");
      setExpenses((prev) => prev.filter(e => e.id !== id));
    } catch (e: any) {
      console.error(e);
      handleFirestoreError(e, OperationType.DELETE, `expenses/${id}`);
    } finally {
      setDeleteExpenseId(null);
    }
  };

  // Reset Expenses, savings goals and all history with Firestore
  const handleResetExpenses = async () => {
    if (!user) return;
    try {
      // 1. Fetch all expenses of current user
      const expensesRef = collection(db, "expenses");
      const qExp = query(expensesRef, where("userId", "==", user.id));
      const expSnap = await getDocs(qExp);

      // 2. Fetch all savings goals of current user
      const goalsRef = collection(db, "goals");
      const qGoals = query(goalsRef, where("userId", "==", user.id));
      const goalsSnap = await getDocs(qGoals);

      // 3. Batch delete all documents
      const expDeletes = expSnap.docs.map(docSnap => deleteDoc(doc(db, "expenses", docSnap.id)));
      const goalDeletes = goalsSnap.docs.map(docSnap => deleteDoc(doc(db, "goals", docSnap.id)));

      await Promise.all([...expDeletes, ...goalDeletes]);

      showToast("Seluruh anggaran, pengeluaran, dan celengan telah di-reset ke nol!", "success");
      setExpenses([]);
      setGoals([]);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Gagal me-reset keuangan", "error");
    } finally {
      setShowResetConfirm(false);
    }
  };

  // Celengan Impian (Savings Goals & Tracker) Functions with Firestore
  const fetchGoals = async () => {
    if (!user) return;
    try {
      const goalsRef = collection(db, "goals");
      const q = query(goalsRef, where("userId", "==", user.id));
      const querySnapshot = await getDocs(q);
      const fetchedGoals: SavingsGoal[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedGoals.push({ id: docSnap.id, ...docSnap.data() } as SavingsGoal);
      });
      // Sort goals by creation date
      fetchedGoals.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setGoals(fetchedGoals);
    } catch (err: any) {
      console.error("Gagal mengambil data celengan:", err);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newGoalTitle.trim() || !newGoalTarget) {
      showToast("Tulis nama impian & target celengan dulu, bro!", "error");
      return;
    }
    const targetVal = Number(newGoalTarget);
    if (isNaN(targetVal) || targetVal <= 0) {
      showToast("Isi nominal target tabungan yang valid ya!", "error");
      return;
    }
    const monthsVal = Number(newGoalMonths) || 1;
    if (monthsVal <= 0) {
      showToast("Isi durasi target waktu menabung yang valid ya!", "error");
      return;
    }

    const newGoalId = "goal-" + Math.random().toString(36).substring(2, 15);
    const dateStr = new Date(Date.now() + simulatedDays * 24 * 60 * 60 * 1000).toISOString();
    const newGoal: SavingsGoal = {
      id: newGoalId,
      userId: user.id,
      title: newGoalTitle,
      targetAmount: targetVal,
      currentAmount: 0,
      category: newGoalCategory,
      createdAt: dateStr,
      targetMonths: monthsVal
    };

    try {
      setIsSavingsLoading(true);
      await setDoc(doc(db, "goals", newGoalId), newGoal);

      showToast(`Celengan Impian "${newGoalTitle}" berhasil dibuat! Yuk konsisten nabung. 🐖`, "success");
      setNewGoalTitle("");
      setNewGoalTarget("");
      setNewGoalMonths("1");
      setShowAddGoal(false);
      setGoals((prev) => [...prev, newGoal]);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, `goals/${newGoalId}`);
    } finally {
      setIsSavingsLoading(false);
    }
  };

  const handleGoalTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedGoalForAction || !goalActionType) return;
    const amountVal = Number(goalActionAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast("Masukkan nominal uang tabungan yang valid ya!", "error");
      return;
    }

    if (goalActionType === "save") {
      if (selectedGoalForAction.currentAmount >= selectedGoalForAction.targetAmount) {
        showToast("Sobat, celengan ini sudah terpenuhi!", "error");
        return;
      }
      if (selectedGoalForAction.currentAmount + amountVal > selectedGoalForAction.targetAmount) {
        showToast(`Nominal kebesaran! Cukup tabung Rp ${(selectedGoalForAction.targetAmount - selectedGoalForAction.currentAmount).toLocaleString("id-ID")} lagi.`, "error");
        return;
      }
    } else if (goalActionType === "withdraw") {
      if (selectedGoalForAction.currentAmount < amountVal) {
        showToast("Saldo tabunganmu di celengan ini gak cukup, bro!", "error");
        return;
      }
    }

    try {
      setIsSavingsLoading(true);
      const goalRef = doc(db, "goals", selectedGoalForAction.id);
      const newAmount = goalActionType === "save" 
        ? selectedGoalForAction.currentAmount + amountVal
        : selectedGoalForAction.currentAmount - amountVal;

      await updateDoc(goalRef, { currentAmount: newAmount });

      // Add automatic expense to reflect sisa saku change
      const newExpenseId = "exp-savetrans-" + Math.random().toString(36).substring(2, 15);
      const dateStr = getSimulatedISODateStr();
      const newExpense: Expense = {
        id: newExpenseId,
        userId: user.id,
        storeName: goalActionType === "save" ? `💰 Tabung: ${selectedGoalForAction.title}` : `💸 Ambil Celengan: ${selectedGoalForAction.title}`,
        totalAmount: goalActionType === "save" ? amountVal : -amountVal,
        category: "Lainnya",
        items: goalActionType === "save" ? ["Masukkan celengan impian"] : ["Tarik celengan ke dompet harian"],
        date: dateStr,
        note: goalActionType === "save" 
          ? `Menyisihkan uang saku untuk target: ${selectedGoalForAction.title}`
          : `Gunakan uang simpanan dari celengan: ${selectedGoalForAction.title}`,
        isAiScanned: false,
        goalId: selectedGoalForAction.id
      };

      await setDoc(doc(db, "expenses", newExpenseId), newExpense);

      if (goalActionType === "save") {
        showToast(`Mantap! Sukses menabung Rp ${amountVal.toLocaleString("id-ID")} ke celengan "${selectedGoalForAction.title}"!`, "success");
      } else {
        showToast(`Berhasil menarik Rp ${amountVal.toLocaleString("id-ID")} dari celengan ke dompet harian!`, "success");
      }
      setGoalActionAmount("");
      setSelectedGoalForAction(null);
      setGoalActionType(null);

      // Local state update immediately
      setGoals((prev) => prev.map(g => g.id === selectedGoalForAction.id ? { ...g, currentAmount: newAmount } : g));
      setExpenses((prev) => [newExpense, ...prev]);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `goals/${selectedGoalForAction.id}`);
    } finally {
      setIsSavingsLoading(false);
    }
  };

  const handleDeleteGoal = async (id: string, title: string, balance: number) => {
    if (!user) return;

    try {
      setIsSavingsLoading(true);
      await deleteDoc(doc(db, "goals", id));

      if (balance > 0) {
        // Create refund expense
        const refundExpenseId = "exp-refund-" + Math.random().toString(36).substring(2, 15);
        const dateStr = getSimulatedISODateStr();
        const refundExpense: Expense = {
          id: refundExpenseId,
          userId: user.id,
          storeName: `💸 Pembubaran Celengan: ${title}`,
          totalAmount: -balance,
          category: "Lainnya",
          items: ["Refund celengan dibubarkan"],
          date: dateStr,
          note: `Semua dana di celengan ${title} dikembalikan ke dompet harian.`,
          isAiScanned: false
        };
        await setDoc(doc(db, "expenses", refundExpenseId), refundExpense);
        setExpenses((prev) => [refundExpense, ...prev]);
      }

      showToast(`Celengan "${title}" resmi dibubarkan!`, "success");
      setGoals((prev) => prev.filter(g => g.id !== id));
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, `goals/${id}`);
    } finally {
      setIsSavingsLoading(false);
      setDeleteGoalObj(null);
    }
  };

  // Split-Bill generator
  const handleGenerateSplitBill = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(splitTotal);
    const people = Number(splitPeople);
    
    if (isNaN(total) || total <= 0) {
      showToast("Isi nominal patungan yang valid dulu!", "error");
      return;
    }
    if (isNaN(people) || people <= 1) {
      showToast("Jumlah orang kudu minimal 2 orang ya!", "error");
      return;
    }

    const perPerson = Math.round(total / people);
    const formattedPerPerson = perPerson.toLocaleString("id-ID");
    const formattedTotal = total.toLocaleString("id-ID");

    const header = `💸 *TAGIHAN PATUNGAN KOSNOMIS* 💸\n`;
    const body = `Halo sobat-sobatku! Ini rincian patungan kita ${splitNote ? `terkait *"${splitNote}"*` : "kemarin"} ya:\n\n` +
                 `• Total Nota: Rp ${formattedTotal}\n` +
                 `• Dibagi: ${people} orang\n` +
                 `• Masing-masing dapet bagian: *Rp ${formattedPerPerson}*\n\n`;
                 
    const footer = transferDetails 
      ? `Monggo ditransfer via:\n👉 *${transferDetails}*\n\n_Ditunggu transferannya ya biar pertemanan kita tetap harmonis, luv u!_`
      : `Bisa langsung ditransfer ke Rekening/E-Wallet biasanya ya. Tengkyu!`;

    setGeneratedWaText(header + body + footer);
    showToast("Sukses bikin draf tagihan patungan!", "success");
  };

  const copyToClipboard = () => {
    if (!generatedWaText) return;
    navigator.clipboard.writeText(generatedWaText);
    setCopiedSuccess(true);
    showToast("Teks tagihan disalin! Siap dikirim ke grup WhatsApp.", "success");
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  // Vibe Meter Style Calculators (Bento Grid Visual Theme)
  const getVibeConfig = (status: "Aman" | "Waspada" | "Kritis" | undefined) => {
    switch (status) {
      case "Aman":
        return {
          bg: "bg-slate-900 border-emerald-500/30 text-emerald-400",
          glow: "shadow-emerald-950/25 ring-1 ring-emerald-500/20",
          textBadge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
          accentText: "text-emerald-400",
          progressBar: "bg-emerald-500",
          emoji: "🌞",
          quote: "Dompetmu aman terkendali, sobat kos! Vibe sejuk kayak dapet transferan mendadak."
        };
      case "Waspada":
        return {
          bg: "bg-slate-900 border-amber-500/30 text-amber-400",
          glow: "shadow-amber-950/25 ring-1 ring-amber-500/20",
          textBadge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
          accentText: "text-amber-400",
          progressBar: "bg-amber-500",
          emoji: "⚠️",
          quote: "Eits, vibe keuangan mulai mendung. Rem dikit nafsu jajan kopimu!"
        };
      case "Kritis":
        return {
          bg: "bg-slate-900 border-red-500/30 text-red-400",
          glow: "shadow-red-950/30 ring-2 ring-red-500/30",
          textBadge: "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse",
          accentText: "text-red-400",
          progressBar: "bg-red-500",
          emoji: "😭",
          quote: "DOMPET KRITIS TOTAL! Sisa saldo setara duga penderitaan mie penyet. Kurangi nongkrong!"
        };
      default:
        return {
          bg: "bg-slate-900 border-slate-700 text-slate-400",
          glow: "shadow-slate-950/10 ring-1 ring-slate-800",
          textBadge: "bg-slate-800 text-slate-400 border border-slate-700",
          accentText: "text-slate-400",
          progressBar: "bg-indigo-500",
          emoji: "🌾",
          quote: "Mulai ubah nominal saku bulananmu dan atur anggaran ketat hari ini!"
        };
    }
  };

  const currentVibe = getVibeConfig(stats?.vibeStatus);

  const filteredExpenses = selectedFilterCategory === "Semua" 
    ? expenses 
    : expenses.filter(e => e.category === selectedFilterCategory);

  const expenseToDeleteObj = expenses.find(e => e.id === deleteExpenseId);

  // Initial onboarding screen if no user loaded
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-indigo-600 text-white p-4.5 rounded-3xl shadow-xl shadow-indigo-500/10 animate-spin">
            <Coins className="h-8 w-8" />
          </div>
          <p className="text-slate-400 text-sm font-medium animate-pulse font-mono">Inisiasi KosNomis Bento System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans relative overflow-hidden">
        {/* Glowing backgrounds */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-15"
        >
          {/* Header Card */}
          <div className="bg-indigo-650 p-8 text-white relative">
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="absolute -inset-1.5 bg-gradient-to-tr from-amber-400 to-indigo-500 rounded-full blur opacity-40 animate-pulse"></div>
                <KosNomisLogo className="relative w-14 h-14 shrink-0" />
              </div>
              <div>
                <div className="inline-flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase backdrop-blur-sm mb-1 font-mono">
                  <Sparkles className="h-3 w-3 text-amber-300 animate-bounce" />
                  <span className="text-amber-100">Penyelamat Dompet Mahasiswa</span>
                </div>
                <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white via-indigo-105 to-amber-200 bg-clip-text text-transparent font-sans">KosNomis</h1>
              </div>
            </div>
            <p className="text-indigo-200 text-xs mt-1 leading-relaxed">Pencatatan keuangan cerdas anak kos Indonesia.</p>
          </div>

          <div className="p-8 space-y-6">
            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-3 cursor-pointer border border-slate-200"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Masuk dengan Google</span>
            </button>
            <p className="text-[10px] text-center text-slate-500 leading-relaxed">Data pengeluaran, sisa saku, dan celengan impian kamu tersimpan aman secara personal di cloud database, bebas bocor.</p>
          </div>

          {/* Footer Card */}
          <div className="bg-slate-950 border-t border-slate-800/80 px-8 py-4 text-center">
            <p className="text-[10px] text-slate-500 font-bold font-mono uppercase tracking-wider">AI Powered by Google Gemini</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans leading-normal overflow-x-hidden">
      
      {/* 1. DESKTOP SIDEBAR PANEL */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-slate-800 bg-slate-900/40 p-6 space-y-8 shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-amber-500 rounded-full blur opacity-45"></div>
            <KosNomisLogo className="relative w-10 h-10 shrink-0" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight font-sans bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">KosNomis</h2>
          </div>
        </div>

        {/* Sidebar Nav (Decorative & Informational) */}
        <nav className="space-y-2.5 flex-1">
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl flex items-center gap-3 font-semibold border border-indigo-500/20 text-xs">
            <Activity className="w-4 h-4 shrink-0" />
            <span>Interactive Dashboard</span>
          </div>
          <div className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl flex items-center gap-3 transition-colors text-xs cursor-pointer" onClick={() => setShowProfileEdit(!showProfileEdit)}>
            <User className="w-4 h-4 shrink-0" />
            <span>Atur Anggaran Kiriman</span>
          </div>
          <div className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl flex items-center gap-3 transition-colors text-xs cursor-pointer" onClick={() => {
            const el = document.getElementById("receipt-logs");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}>
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Riwayat Pengeluaran</span>
          </div>
        </nav>

        {/* User Card inside Sidebar */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative">
          <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-emerald-500"></span>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold font-mono mb-2">PENGGUNA AKTIF</p>
          <div className="flex items-center gap-3">
            <img 
              src={user.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=KosNomis"}
              alt="Avatar"
              className="w-10 h-10 rounded-full border border-slate-850 bg-slate-950" 
            />
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">Sobat Kos Cerdas</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <button 
              onClick={() => setShowProfileEdit(!showProfileEdit)}
              className="hover:text-indigo-400 font-bold transition-all text-left"
            >
              Atur Profil
            </button>
            <button 
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto pb-12">
        
        {/* MOBILE TOP CONTROLLER HEADER */}
        <header className="lg:hidden bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute -inset-0.5 bg-gradient-to-tr from-indigo-500 to-amber-505 rounded-full blur opacity-30"></div>
              <KosNomisLogo className="relative w-8 h-8 shrink-0" />
            </div>
            <h1 className="text-lg font-black tracking-tight font-sans bg-gradient-to-r from-white to-slate-150 bg-clip-text text-transparent">KosNomis</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowProfileEdit(!showProfileEdit)}
              className="p-1.5 bg-slate-800 rounded-lg text-slate-400"
              title="Atur Budget"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-1.5 bg-red-950/50 text-red-500 rounded-lg"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* MAIN BODY AREA */}
        <div className="p-6 md:p-8 space-y-8 max-w-6xl w-full mx-auto">
          
          {/* HEADER GREETINGS */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Halo, {user.name}!</span>
                <span className="text-xl sm:text-2xl animate-bounce">👋</span>
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                {(() => {
                  const { currentCycleDay, daysUntilNextAllowance } = getSimulatedCycleDetails();
                  return `Hari ke-${currentCycleDay} dari siklus ini. Sisa ${daysUntilNextAllowance} hari lagi menuju tanggal transferan ortu (tanggal ${user.allowanceDay}).`;
                })()}
              </p>
            </div>
            
            <button 
              onClick={() => setShowProfileEdit(!showProfileEdit)}
              className="self-start md:self-auto bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs px-4 py-2.5 rounded-full border border-slate-800 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400 animate-spin-slow" />
              <span>{showProfileEdit ? "Tutup Setup Budget" : "Atur Anggaran Kiriman"}</span>
            </button>
          </div>

          {/* KOSNOMIS TIME MACHINE DEVELOPER SANDBOX */}
          <div className="bg-slate-900/60 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-lg shadow-indigo-950/10 relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-start gap-3.5 w-full lg:w-auto">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-mono">Simulasi Waktu:</span>
                  <span className="bg-indigo-650/40 text-indigo-300 text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-mono animate-pulse tracking-wide border border-indigo-400/20">Time Machine Active</span>
                </div>
                <h3 className="text-xs font-bold text-slate-200">Simulasikan Kemajuan Hari & Matematika Tabungan</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                  Lompati hari ke masa depan untuk melihat kalkulator sisa saku bergerak turun, serta menyulut respons kritis <b>Asisten Finansial AI</b> bila ada celengan impian yang tidak realistis secara matematis!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
              <div className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-850 px-3.5 py-2 rounded-xl font-mono text-center flex flex-col md:flex-row items-center gap-2 justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-sans">Tanggal Simulasi:</span>
                  <span className={simulatedDays === 0 ? "text-emerald-400 animate-pulse font-extrabold" : "text-yellow-400 font-extrabold"}>
                    {getSimulatedDateLabel()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 md:border-l md:border-slate-800 md:pl-2 pt-1 md:pt-0">
                  <span className="text-slate-500 font-sans">Status Siklus:</span>
                  <span className="text-indigo-400 font-black font-sans">
                    Hari Ke-{getSimulatedCycleDetails().currentCycleDay}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-850 w-full sm:w-auto">
                <button 
                  onClick={() => updateSimulatedDays(0)}
                  disabled={simulatedDays === 0}
                  className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition-all text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 cursor-pointer"
                  title="Reset ke Hari Ini"
                >
                  Reset
                </button>

                <button 
                  onClick={() => updateSimulatedDays(simulatedDays + 1)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg shadow transition-all cursor-pointer flex items-center gap-1"
                  title="Maju 1 Hari"
                >
                  <span>+1 Hari</span>
                </button>

                <button 
                  onClick={() => updateSimulatedDays(simulatedDays + 7)}
                  className="px-2 py-1 bg-slate-850 hover:bg-slate-750 text-slate-200 text-[10px] font-bold rounded-lg shadow transition-all cursor-pointer"
                  title="Maju 1 Minggu"
                >
                  +7 Hari
                </button>

                <button 
                  onClick={() => updateSimulatedDays(simulatedDays + 15)}
                  className="px-2 py-1 bg-red-950/60 hover:bg-red-900 border border-red-900/30 text-red-200 text-[10px] font-bold rounded-lg shadow transition-all cursor-pointer"
                  title="Maju ke Akhir Bulan (Tinggal Sedikit Hari)"
                >
                  +15 Hari (Akhir Bulan!)
                </button>
              </div>
            </div>
          </div>

          {/* EDIT CONFIG SHEET (IF CLICKED) */}
          <AnimatePresence>
            {showProfileEdit && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <form onSubmit={handleUpdateProfile} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-indigo-450" />
                      <span>Setup Profil Keuangan Kos</span>
                    </h3>
                    <button 
                      type="button" 
                      onClick={() => setShowProfileEdit(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-400"
                    >
                      Batal
                    </button>
                  </div>

                  {/* KOSNOMIS AVATAR UPLOAD COMPONENT */}
                  <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-6">
                    {/* Left: Interactive Circular Avatar Representation */}
                    <div className="relative group shrink-0">
                      <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-505 to-amber-500 rounded-full blur opacity-40 group-hover:opacity-75 transition-opacity duration-300"></div>
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-slate-800 bg-slate-900 flex items-center justify-center">
                        {isUploadingAvatar ? (
                          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                        ) : (
                          <img 
                            src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=KosNomis"} 
                            alt="Avatar Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        
                        {/* Upload trigger button overlay */}
                        <label 
                          htmlFor="avatar-file-upload" 
                          className="absolute inset-0 bg-slate-955/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity duration-200 text-white"
                        >
                          <Camera className="w-6 h-6 mb-1 text-slate-300" />
                          <span className="text-[9px] font-black font-mono uppercase tracking-widest">Ubah Foto</span>
                        </label>
                      </div>
                    </div>

                    {/* Right: Drag & Drop upload or manual select panel */}
                    <div className="flex-1 w-full">
                      <div 
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            handleAvatarUpload(file);
                          }
                        }}
                        onClick={() => document.getElementById("avatar-file-upload")?.click()}
                        className="border-2 border-dashed border-slate-800 hover:border-indigo-505 bg-slate-900/40 hover:bg-slate-950/50 p-4.5 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group"
                      >
                        <input 
                          id="avatar-file-upload"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleAvatarUpload(file);
                            }
                          }}
                          className="hidden"
                        />
                        <UploadCloud className="w-7 h-7 text-slate-500 group-hover:text-indigo-400 mb-1.5 transition-colors duration-200" />
                        <p className="text-xs font-bold text-slate-300">Tarik & Lepas gambar atau <span className="text-indigo-400 underline decoration-indigo-450/45">cari file</span></p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Mendukung PNG, JPG, WEBP (Maksimal 5MB)</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Nama Panggilan</label>
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-855 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Kiriman Ortu Bulanan (Rp)</label>
                      <input 
                        type="number" 
                        value={editAllowance}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditAllowance(val === "" ? "" : Number(val));
                        }}
                        className="w-full bg-slate-950 border border-slate-855 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Tanggal Transferan Ortu (1-31)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="31"
                        value={editAllowanceDay}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditAllowanceDay(val === "" ? "" : Number(val));
                        }}
                        className="w-full bg-slate-950 border border-slate-855 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Simpan & Hitung Ulang Anggaran
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ========================================================
              3. THE GLORIOUS BENTO GRID CONTROLLER
             ======================================================== */}
          <div className="grid grid-cols-12 gap-5">
            
            {/* CELL 1: MAIN BALANCE & VIBE METER (col-span-12 lg:col-span-8) */}
            <div className={`col-span-12 lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-xl ${currentVibe.glow}`}>
              {/* Background gradient hint */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-650/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Sisa Anggaran Saku</p>
                  <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tighter mt-1">
                    Rp {clientStats.remainingBudget.toLocaleString("id-ID")}
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 mt-3 text-xs">
                    <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 rounded-full font-medium">
                      Bujet Awal: Rp {user.monthlyAllowance.toLocaleString("id-ID")}
                    </span>
                    <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-full font-mono">
                      {expenses.length} Transaksi Terdaftar
                    </span>
                  </div>
                </div>

                {/* Status Badge right */}
                <div className="text-left sm:text-right">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest font-mono">Status Vibe</p>
                  <div className="inline-flex items-center gap-1.5 mt-1">
                    <span className="text-2xl">{currentVibe.emoji}</span>
                    <span className={`font-black text-sm uppercase tracking-widest ${currentVibe.accentText}`}>
                      {stats?.vibeStatus || "Aman"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Progress indicator */}
              <div className="mt-8 pt-6 border-t border-slate-800/65 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Anggaran Terpakai</span>
                  <span className={currentVibe.accentText}>
                    {Math.round((clientStats.totalExpenses / user.monthlyAllowance) * 100)}%
                  </span>
                </div>
                
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${currentVibe.progressBar}`}
                    style={{ width: `${clientStats.progressPercent}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Terpakai: Rp {clientStats.totalExpenses.toLocaleString("id-ID")}</span>
                  <span>Sisa: Rp {clientStats.remainingBudget.toLocaleString("id-ID")}</span>
                </div>
              </div>
            </div>

            {/* CELL 2: CELENGAN IMPIAN BENTO (col-span-12 lg:col-span-4) */}
            <div 
              className="col-span-12 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden shadow-xl"
            >
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                      <PiggyBank className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-100 tracking-tight">Celengan Impian</h4>
                      <p className="text-[10px] text-slate-400 font-semibold font-mono tracking-wide">SAVINGS & WISHLIST</p>
                    </div>
                  </div>
                  {!showAddGoal && (
                    <button 
                      onClick={() => setShowAddGoal(true)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-all"
                    >
                      + Baru
                    </button>
                  )}
                </div>

                {/* ADD CELENGAN FORM */}
                {showAddGoal ? (
                  <form onSubmit={handleCreateGoal} className="space-y-4 p-4 bg-slate-950/60 rounded-2.5xl border border-slate-800 animate-fadeIn">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                      <span>Rancang Impian Baru 🐖</span>
                      <button 
                        type="button" 
                        onClick={() => setShowAddGoal(false)}
                        className="text-red-400 hover:text-red-300 font-bold"
                      >
                        Batal
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Nama Impian / Barang</label>
                        <input 
                          type="text"
                          value={newGoalTitle}
                          onChange={(e) => setNewGoalTitle(e.target.value)}
                          placeholder="Ex: Sepatu Sneakers, Mudik Lebaran"
                          className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 placeholder-slate-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Target Tabungan (Rp)</label>
                        <input 
                          type="number"
                          value={newGoalTarget}
                          onChange={(e) => setNewGoalTarget(e.target.value)}
                          placeholder="Ex: 500000"
                          className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-100 placeholder-slate-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Target Waktu (Bulan)</label>
                        <input 
                          type="number"
                          value={newGoalMonths}
                          onChange={(e) => setNewGoalMonths(e.target.value)}
                          placeholder="Ex: 2"
                          min="1"
                          className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-100 placeholder-slate-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Kategori Target</label>
                        <select 
                          value={newGoalCategory}
                          onChange={(e) => setNewGoalCategory(e.target.value as SavingsGoalCategory)}
                          className="w-full bg-slate-900 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 text-slate-300"
                        >
                          <option value="Dana Darurat">🚨 Dana Darurat</option>
                          <option value="Gadget">📱 Gadget & Elektronik</option>
                          <option value="Liburan/Mudik">✈️ Mudik / Liburan</option>
                          <option value="Fashion/Sepatu">👟 Fashion & Sepatu</option>
                          <option value="Lainnya">📦 Lainnya</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSavingsLoading}
                      className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-550 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
                    >
                      {isSavingsLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Mulai Menabung</span>
                    </button>
                  </form>
                ) : (
                  /* GOALS LIST VIEW */
                  <div className="space-y-3 max-h-[310px] overflow-y-auto pr-1 select-none">
                    {goals.length === 0 ? (
                      <div className="text-center py-8 px-4 bg-slate-950/40 rounded-3xl border border-dashed border-slate-800">
                        <PiggyBank className="h-8 w-8 text-slate-600 mx-auto mb-2 animate-bounce" />
                        <p className="text-xs font-bold text-slate-300">Celengan Masih Kosong</p>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">Rancang wishlist barang impian atau dana daruratmu dengan menyisihkan uang kiriman secara bertahap.</p>
                        <button 
                          onClick={() => setShowAddGoal(true)}
                          className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg transition-all"
                        >
                          Buat Celengan Impian
                        </button>
                      </div>
                    ) : (
                      goals.map((goal) => {
                        const progressPercent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                        const isFinished = goal.currentAmount >= goal.targetAmount;
                        
                        // Custom color tag categorizer
                        const getCatColor = (cat: string) => {
                          switch (cat) {
                            case "Gadget": return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
                            case "Liburan/Mudik": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                            case "Dana Darurat": return "bg-rose-500/10 text-rose-450 border border-rose-500/20 animate-pulse";
                            case "Fashion/Sepatu": return "bg-pink-500/10 text-pink-400 border border-pink-500/20";
                            default: return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                          }
                        };

                        return (
                          <div 
                            key={goal.id} 
                            className={`p-3.5 rounded-2xl bg-slate-950/85 border transition-all ${isFinished ? "border-emerald-500/40" : "border-slate-850 hover:border-slate-800"}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${getCatColor(goal.category)}`}>
                                  {goal.category}
                                </span>
                                <h5 className="font-extrabold text-xs text-slate-200 mt-1.5 leading-snug">{goal.title}</h5>
                              </div>
                              <button 
                                onClick={() => setDeleteGoalObj(goal)}
                                className="text-slate-600 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                                title="Bubarkan Celengan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Progress bar inside specific goal card */}
                            <div className="mt-4 space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-400 font-mono">Rp {goal.currentAmount.toLocaleString("id-ID")}</span>
                                <span className={isFinished ? "text-emerald-400" : "text-indigo-400"}>
                                  {progressPercent}% {isFinished && "🎯"}
                                </span>
                              </div>
                              
                              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden p-0">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${isFinished ? "bg-emerald-500" : "bg-indigo-500"}`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>

                              <p className="text-[9px] text-slate-400 font-mono text-left leading-relaxed">
                                Target: Rp {goal.targetAmount.toLocaleString("id-ID")} dalam {goal.targetMonths || 1} Bulan
                                {goal.currentAmount < goal.targetAmount && (
                                  <span className="block text-[8px] text-slate-500 mt-0.5">
                                    Butuh: Rp {Math.ceil((goal.targetAmount - goal.currentAmount) / (goal.targetMonths || 1)).toLocaleString("id-ID")}/bulan
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Celengan Actions bar */}
                            <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-slate-900">
                              <button 
                                onClick={() => {
                                  setSelectedGoalForAction(goal);
                                  setGoalActionType("save");
                                  setGoalActionAmount("");
                                }}
                                className="px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 text-3xs sm:text-[10px] font-bold rounded-lg border border-emerald-500/20 transition-all text-center cursor-pointer"
                              >
                                💰 Tabung
                              </button>
                              <button 
                                onClick={() => {
                                  if (goal.currentAmount <= 0) {
                                    showToast("Celengan kamu masih ompong, belum ada saldo yang bisa ditarik bro!", "error");
                                    return;
                                  }
                                  setSelectedGoalForAction(goal);
                                  setGoalActionType("withdraw");
                                  setGoalActionAmount("");
                                }}
                                className="px-2 py-1.5 bg-slate-800 hover:bg-amber-400 text-slate-300 hover:text-slate-950 text-3xs sm:text-[10px] font-bold rounded-lg border border-slate-755 transition-all text-center cursor-pointer"
                              >
                                💸 Ambil
                              </button>
                            </div>

                            {/* INLINE ACTION OVERLAY FORM */}
                            {selectedGoalForAction?.id === goal.id && (
                              <form onSubmit={handleGoalTransaction} className="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2.5 animate-fadeIn">
                                <div className="flex justify-between items-center text-3xs font-extrabold uppercase tracking-wide text-slate-400">
                                  <span>{goalActionType === "save" ? "💸 Masukkan Dana saku ke Celengan" : "💰 Pecahkan Celengan ke Dompet"}</span>
                                  <button 
                                    type="button" 
                                    onClick={() => { setSelectedGoalForAction(null); setGoalActionType(null); }} 
                                    className="text-red-400 font-bold hover:text-red-350"
                                  >
                                    Batal
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <input 
                                    type="number"
                                    value={goalActionAmount}
                                    onChange={(e) => setGoalActionAmount(e.target.value)}
                                    placeholder="Nominal Rp (Ex: 50000)"
                                    className="flex-1 bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs font-semibold rounded-lg focus:outline-none text-slate-100 placeholder-slate-700"
                                    autoFocus
                                  />
                                  <button 
                                    type="submit" 
                                    disabled={isSavingsLoading}
                                    className={`px-3 py-1.5 text-xs font-black rounded-lg text-slate-950 ${goalActionType === "save" ? "bg-emerald-400 hover:bg-emerald-350" : "bg-amber-400 hover:bg-amber-350"}`}
                                  >
                                    {isSavingsLoading ? "Wait" : "OK"}
                                  </button>
                                </div>
                              </form>
                            )}

                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CELL 3: AI COACH / MODE AKHIR BULAN ROASTS (col-span-12 lg:col-span-8) */}
            <div className="col-span-12 lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 relative flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest">Bacotan Gemini (AI Coach)</span>
                  </div>
                  <Coins className="h-4 w-4 text-slate-600" />
                </div>

                <blockquote className="text-base sm:text-lg font-bold text-slate-200 mt-2 italic leading-relaxed">
                  "{stats?.vibeMessage || "Sabar ya sobat, KosNomis AI Coach sedang merangkum petuah terbaik buat menghemat saku kamu..."}"
                </blockquote>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/75 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Nasihat khas daerah & Kampus</span>
                </span>
                <span className="flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Update otomatis tiap transaksi</span>
                </span>
              </div>
            </div>

            {/* CELL 4: WHATSAPP SPLIT BILL COMPACT GENERATOR (col-span-12 lg:col-span-4) */}
            <div className="col-span-12 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
              <div>
                <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp Split Bill</p>
                <h4 className="text-lg font-black text-slate-200 mb-1">Kalkulator Patungan</h4>
                <p className="text-[11px] text-slate-400">Paling sebel nagih utang? Buat pesan WhatsApp ramah-lucu.</p>

                <form onSubmit={handleGenerateSplitBill} className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="number" 
                      value={splitTotal}
                      onChange={(e) => setSplitTotal(e.target.value)}
                      placeholder="Total Pembayaran"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none font-bold"
                    />
                    <input 
                      type="number" 
                      value={splitPeople}
                      onChange={(e) => setSplitPeople(e.target.value)}
                      placeholder="Jumlah Orang"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none font-bold"
                    />
                  </div>
                  <input 
                    type="text" 
                    value={splitNote}
                    onChange={(e) => setSplitNote(e.target.value)}
                    placeholder="Nama Kegiatan (ex: Seblak Maut)"
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
                  />
                  <input 
                    type="text" 
                    value={transferDetails}
                    onChange={(e) => setTransferDetails(e.target.value)}
                    placeholder="Info Rek/DANA (ex: BCA 1234...)"
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
                  />

                  {splitFriends.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-mono font-bold text-slate-400 tracking-widest uppercase">Nomor WhatsApp Teman (Opsional)</label>
                        <span className="text-[9px] font-bold text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded-md">+{splitFriends.length} Kontak</span>
                      </div>
                      <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {splitFriends.map((friend, idx) => (
                          <div key={idx} className="flex gap-1.5 items-center">
                            <span className="text-[9px] font-mono font-bold text-slate-500 w-3.5 text-center">{idx + 1}</span>
                            <input 
                              type="text" 
                              value={friend.name}
                              onChange={(e) => {
                                const updated = [...splitFriends];
                                updated[idx].name = e.target.value;
                                setSplitFriends(updated);
                              }}
                              placeholder="Nama Teman"
                              className="w-1/2 bg-slate-950 border border-slate-850 text-[10px] text-slate-250 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none placeholder:text-slate-650"
                            />
                            <input 
                              type="text" 
                              value={friend.phone}
                              onChange={(e) => {
                                const updated = [...splitFriends];
                                updated[idx].phone = e.target.value;
                                setSplitFriends(updated);
                              }}
                              placeholder="No WA (0812...)"
                              className="w-1/2 bg-slate-950 border border-slate-850 text-[10px] text-slate-250 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none font-mono placeholder:text-slate-650"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-505 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-indigo-950/20 border border-indigo-500/10"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Generate Tagihan WA</span>
                  </button>
                </form>
              </div>

              {generatedWaText && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <a 
                      href={getGeneralWaUrl()} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer border border-emerald-500/15"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>Kirim ke WA</span>
                    </a>
                    
                    <button 
                      onClick={copyToClipboard}
                      className="text-xs font-bold bg-slate-850 hover:bg-slate-750 text-slate-300 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-800"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copiedSuccess ? "Disalin!" : "Salin Teks"}</span>
                    </button>
                  </div>

                  {splitFriends.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-850/70 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Kirim Japri Langsung ke WA:</p>
                      </div>
                      
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                        {splitFriends.map((friend, idx) => {
                          const hasPhone = friend.phone.trim().length > 0;
                          return (
                            <a 
                              key={idx}
                              href={getDirectWaUrl(friend)}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`w-full text-left text-xs py-2 px-3 rounded-xl flex items-center justify-between border transition-all cursor-pointer ${
                                hasPhone 
                                  ? "bg-slate-950 hover:bg-slate-900 border-slate-850 hover:border-emerald-550/40 text-slate-300 hover:text-emerald-400" 
                                  : "bg-slate-950/50 hover:bg-slate-950 border-slate-850/60 hover:border-slate-800 text-slate-450 hover:text-slate-350"
                              }`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className={`font-semibold text-[10.5px] truncate ${hasPhone ? "text-slate-200" : "text-slate-450"}`}>
                                  {friend.name.trim() || `Teman ${idx + 1}`}
                                </span>
                                <span className="text-[9px] font-mono opacity-80 truncate">
                                  {hasPhone ? friend.phone : "Tanpa Nomor WA (Grup Share)"}
                                </span>
                              </div>
                              <div className={`flex items-center gap-1 text-[10px] font-bold ${hasPhone ? "text-emerald-500" : "text-indigo-400"}`}>
                                <span>Kirim</span>
                                <ArrowRight className="h-3 w-3" />
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CELL 5: MANUAL TRANSACTION INPUT (col-span-12 lg:col-span-7) */}
            <div className="col-span-12 lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-850">
                  <Plus className="h-5 w-5 text-indigo-400" />
                  <h4 className="text-base font-black text-slate-100">Input Transaksi Manual</h4>
                </div>

                <form onSubmit={handleAddManualExpense} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Nama Merchant / Toko</label>
                      <input 
                        type="text" 
                        required
                        value={manualStoreName}
                        onChange={(e) => setManualStoreName(e.target.value)}
                        placeholder="Contoh: Warmindo, Parkir FIB"
                        className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Jumlah Uang (Rp)</label>
                      <input 
                        type="number" 
                        required
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        placeholder="Contoh: 15000"
                        className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Kategori</label>
                      <select 
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value as ExpenseCategory)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="Makanan">Makanan</option>
                        <option value="Kos/Utilitas">Kos/Utilitas</option>
                        <option value="Tugas/Kuliah">Tugas/Kuliah</option>
                        <option value="Hiburan">Hiburan</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Daftar Barang (Paku koma)</label>
                      <input 
                        type="text" 
                        value={manualItems}
                        onChange={(e) => setManualItems(e.target.value)}
                        placeholder="Print lapor, es teh manis"
                        className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Catatan Kecil</label>
                    <input 
                      type="text" 
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="Contoh: Patungan bensin makrab"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-indigo-650 hover:bg-indigo-550 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Simpan Transaksi Manual
                  </button>
                </form>
              </div>
            </div>

            {/* CELL 6: DEEP PERFORMANCE STATS HIGHLIGHT (col-span-12 lg:col-span-5) */}
            <div className="col-span-12 lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">Rekomendasi Aman Harian</h4>
                  <Wallet className="h-4 w-4 text-indigo-400" />
                </div>

                <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 pr-4 pb-2 text-3xl opacity-10">📉</div>
                  <p className="text-[9px] font-bold text-slate-550 uppercase tracking-widest font-mono">Angka Saku Aman</p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
                    Rp {clientStats.dailyBudgetLimit.toLocaleString("id-ID")}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                    Maksimum pembelanjaan harian biar saku awet sampai kiriman ortu berikutnya datang.
                  </p>
                </div>

                {/* Additional analytics bento items */}
                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-850">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">Saku Awal</span>
                    <span className="text-xs font-bold text-slate-300">Rp {user.monthlyAllowance.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-850">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">Penyelamat AI</span>
                    <span className="text-xs font-bold text-indigo-400">Status Aktif</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-medium pt-5 mt-4 border-t border-slate-800/80 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>Metrik dihitung real-time menggunakan alur saku transaksional.</span>
              </div>
            </div>

          </div>

          {/* ========================================================
              4. COMPACT REGISTER LOGS TABLE
             ======================================================== */}
          <section id="receipt-logs" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl scroll-mt-20">
            
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center flex-wrap gap-3">
                  <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-indigo-400" />
                    <span>Riwayat Detail Anggaran Kos</span>
                  </h3>
                  
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold tracking-wider uppercase rounded-xl border border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Hapus semua belanjaan dan kembalikan sisa saku ke awal"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Reset Keuangan</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Pantau pengeluaran bulanan atau hapus data fintek kosan Anda secara bersih.</p>
              </div>

              {/* Filtering layout & Quick Scroll Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
                  {["Semua", "Makanan", "Kos/Utilitas", "Tugas/Kuliah", "Hiburan", "Lainnya"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedFilterCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedFilterCategory === cat 
                          ? "bg-indigo-600 text-white" 
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {filteredExpenses.length > 3 && (
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
                    <button
                      onClick={handleScrollTableTop}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-indigo-400 text-[11px] font-bold rounded-lg border border-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                      title="Gulir ke paling atas tabel"
                    >
                      <span>Atas</span>
                      <span>↑</span>
                    </button>
                    <button
                      onClick={handleScrollTableBottom}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-indigo-400 text-[11px] font-bold rounded-lg border border-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                      title="Gulir ke paling bawah tabel"
                    >
                      <span>Bawah</span>
                      <span>↓</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Expenses Table */}
            <div 
              ref={budgetTableContainerRef}
              className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-slate-850 bg-slate-950/40 custom-scrollbar relative"
            >
              {filteredExpenses.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 border-b border-slate-850 text-slate-400 font-mono sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Kategori</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Toko / Merchant</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Daftar Item</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Tanggal</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Nominal Belanja</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Metode Catat</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 text-slate-300">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-900/35 transition-colors">
                        <td className="p-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            exp.category === "Makanan" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            exp.category === "Kos/Utilitas" ? "bg-red-500/10 text-red-405 border border-red-500/20" :
                            exp.category === "Tugas/Kuliah" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            exp.category === "Hiburan" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                            "bg-slate-800 text-slate-400 border border-slate-705"
                          }`}>
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-bold text-slate-200">{exp.storeName}</p>
                            {exp.note && <span className="text-[10px] text-slate-500 block mt-0.5">{exp.note}</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          {exp.items && exp.items.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {exp.items.map((item, idx) => (
                                <span key={idx} className="bg-slate-900 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-800">
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-550 italic text-[10px]">Tiada barang detail</span>
                          )}
                        </td>
                        <td className="p-4 text-xs font-mono text-slate-500">
                          {exp.date}
                        </td>
                        <td className="p-4 text-sm font-bold text-white">
                          Rp {exp.totalAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="p-4">
                          {exp.isAiScanned ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-505/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                              <Sparkles className="h-3 w-3 shrink-0" />
                              <span>AI SCAN</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                              MANUAL
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => setDeleteExpenseId(exp.id)}
                            className="p-1.5 text-slate-500 hover:text-red-405 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer inline-flex"
                            title="Hapus Pengeluaran"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-slate-500 bg-slate-950/20">
                  <Receipt className="h-8 w-8 text-slate-750 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-wider font-mono">Belum Ada Transaksi Tercatat</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Mulai catat transaksi secara manual atau sisihkan saku Anda ke Celengan Impian.</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* Confirmation and Notification Overlays */}
      <AnimatePresence>
        {/* Custom Toast notification */}
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-slate-900 border border-slate-800 text-slate-100 px-5 py-4 rounded-2xl shadow-2xl max-w-sm"
          >
            {toastMessage.type === "success" ? (
              <div className="bg-emerald-500/15 p-2 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
            ) : toastMessage.type === "error" ? (
              <div className="bg-red-500/15 p-2 rounded-xl border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
            ) : (
              <div className="bg-blue-500/15 p-2 rounded-xl border border-blue-500/20">
                <Info className="h-4 w-4 text-blue-400" />
              </div>
            )}
            <p className="text-xs font-semibold leading-relaxed">{toastMessage.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Custom Delete Confirmation Modal */}
        {deleteExpenseId && expenseToDeleteObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500/80"></div>
              
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-500/10 p-2.5 rounded-2xl border border-red-500/20 text-red-400 animate-pulse">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider font-mono">Hapus Pengeluaran</h4>
              </div>
              
              <p className="text-xs text-slate-350 leading-relaxed mb-5">
                Apakah kamu yakin ingin menghapus catatan belanja di <span className="font-bold text-slate-100">"{expenseToDeleteObj.storeName}"</span> sebesar <span className="font-bold text-emerald-400 font-mono">Rp {expenseToDeleteObj.totalAmount.toLocaleString("id-ID")}</span>? Catatan pengeluaran harian dan rekomendasi sakumu akan dihitung ulang secara otomatis.
              </p>
              
              <div className="flex gap-2.5 justify-end">
                <button
                  onClick={() => setDeleteExpenseId(null)}
                  className="flex-1 py-3 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDeleteExpense(deleteExpenseId)}
                  className="flex-1 py-3 bg-red-650 hover:bg-red-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all border border-red-500/20"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Custom Celengan Deletion Confirmation Modal */}
        {deleteGoalObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500/80"></div>
              
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-rose-500/10 p-2.5 rounded-2xl border border-rose-500/20 text-rose-400">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider font-mono">Bubarkan Celengan</h4>
              </div>
              
              <p className="text-xs text-slate-350 leading-relaxed mb-5">
                {deleteGoalObj.currentAmount > 0 ? (
                  <>
                    Bubarkan celengan <span className="font-bold text-slate-100">"{deleteGoalObj.title}"</span>? Seluruh tabungan tersimpan sebesar <span className="font-bold text-amber-400 font-mono">Rp {deleteGoalObj.currentAmount.toLocaleString("id-ID")}</span> otomatis di-refund kembali ke anggaran dompet harianmu secara instan.
                  </>
                ) : (
                  <>
                    Apakah kamu yakin ingin membubarkan celengan impian <span className="font-bold text-slate-100">"{deleteGoalObj.title}"</span>? Celengan ini akan dihapus permanen.
                  </>
                )}
              </p>
              
              <div className="flex gap-2.5 justify-end">
                <button
                  onClick={() => setDeleteGoalObj(null)}
                  className="flex-1 py-3 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDeleteGoal(deleteGoalObj.id, deleteGoalObj.title, deleteGoalObj.currentAmount)}
                  className="flex-1 py-3 bg-red-650 hover:bg-red-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all border border-red-500/20"
                >
                  Ya, Bubarkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Custom Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600 animate-pulse"></div>
              
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-500/10 p-2.5 rounded-2xl border border-red-500/20 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider font-mono">Reset Total Keuangan Kos</h4>
              </div>
              
              <p className="text-xs text-slate-350 leading-relaxed mb-6">
                ⚠️ <span className="font-extrabold text-red-400 uppercase">PERINGATAN!</span> Tindakan ini akan menghapus <span className="font-semibold text-slate-100">SELURUH riwayat pengeluaran, daftar Celengan Impian, serta seluruh tabungan Anda</span> secara bersih dari aplikasi. Rekomendasi harian, kalkulator saldo saku, dan tabungan akan kembali bersih mulai dari nol.
              </p>
              
              <div className="flex gap-2.5 justify-end">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-3 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 flex-1 cursor-pointer transition-all"
                >
                  Batalkan
                </button>
                <button
                  onClick={handleResetExpenses}
                  className="px-4 py-3 bg-red-600 hover:bg-red-555 text-white font-bold text-xs rounded-xl flex-1 cursor-pointer transition-all border border-red-500/30 shadow-lg shadow-red-950/30"
                >
                  Ya, Reset Bersih!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

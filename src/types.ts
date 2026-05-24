export interface UserProfile {
  id: string;
  name: string;
  monthlyAllowance: number;
  allowanceDay: number; // 1 to 31
  avatarUrl?: string;
  joinedAt: string;
}

export type ExpenseCategory = "Makanan" | "Kos/Utilitas" | "Tugas/Kuliah" | "Hiburan" | "Lainnya";

export interface Expense {
  id: string;
  userId: string;
  storeName: string;
  totalAmount: number;
  category: ExpenseCategory;
  items: string[];
  date: string; // YYYY-MM-DD
  note?: string;
  isAiScanned: boolean;
  goalId?: string;
}

export interface FinancialStats {
  remainingBudget: number;
  totalExpenses: number;
  daysUntilNextAllowance: number;
  dailyBudgetLimit: number; // recommended per day
  vibeStatus: "Aman" | "Waspada" | "Kritis";
  vibeMessage: string;
  currentCycleDay?: number;
}

export interface SplitBillRequest {
  totalAmount: number;
  numberOfPeople: number;
  itemsNote?: string;
  yourDetails?: string; // e.g. "BCA 12345678"
}

export type SavingsGoalCategory = "Gadget" | "Liburan/Mudik" | "Dana Darurat" | "Fashion/Sepatu" | "Lainnya";

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  category: SavingsGoalCategory;
  createdAt: string;
  targetMonths: number; // e.g. 1, 2, 3 months
}


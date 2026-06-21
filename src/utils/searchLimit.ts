// src/utils/searchLimit.ts

const SEARCH_LIMIT = 3; // Change to 2, 3, or 4
const STORAGE_KEY = "sealcargo_user_data";

export interface UserSearchData {
  userId: string;
  email: string;
  name: string;
  searchCount: number;
  searches: {
    timestamp: string;
    productType: string;
    keyword: string;
  }[];
  limitReached: boolean;
}

// Generate simple ID from email
function generateUserId(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `user_${Math.abs(hash)}`;
}

// Get or create user data
export function getUserData(email: string, name: string): UserSearchData {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    const parsed: UserSearchData = JSON.parse(stored);
    // If same email, return existing data
    if (parsed.email === email) {
      return parsed;
    }
  }

  // New user
  const newUser: UserSearchData = {
    userId: generateUserId(email),
    email,
    name,
    searchCount: 0,
    searches: [],
    limitReached: false,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  return newUser;
}

// Check if user can search
export function canUserSearch(email: string, name: string): boolean {
  const data = getUserData(email, name);
  return data.searchCount < SEARCH_LIMIT;
}

// Get remaining searches
export function getRemainingSearches(email: string, name: string): number {
  const data = getUserData(email, name);
  return Math.max(0, SEARCH_LIMIT - data.searchCount);
}

// Record a search
export function recordSearch(
  email: string,
  name: string,
  productType: string,
  keyword: string
): void {
  const data = getUserData(email, name);

  data.searchCount += 1;
  data.searches.push({
    timestamp: new Date().toISOString(),
    productType,
    keyword,
  });

  if (data.searchCount >= SEARCH_LIMIT) {
    data.limitReached = true;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Get search limit number
export function getSearchLimit(): number {
  return SEARCH_LIMIT;
}

// Reset (for testing only)
export function resetUserData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
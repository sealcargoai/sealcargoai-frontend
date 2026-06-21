// REPLACE the entire searchLimit.ts with this improved version:

const SEARCH_LIMIT = 3;
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

function generateUserId(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `user_${Math.abs(hash)}`;
}

// Get raw data from localStorage
function getRawData(): UserSearchData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Save data to localStorage
function saveData(data: UserSearchData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getUserData(email: string, name: string): UserSearchData {
  const stored = getRawData();

  if (stored && stored.email === email) {
    // Update name if changed
    if (stored.name !== name && name) {
      stored.name = name;
      saveData(stored);
    }
    return stored;
  }

  // New user or different email
  const newUser: UserSearchData = {
    userId: generateUserId(email),
    email,
    name,
    searchCount: 0,
    searches: [],
    limitReached: false,
  };

  saveData(newUser);
  return newUser;
}

export function canUserSearch(email: string, name: string): boolean {
  const data = getUserData(email, name);
  console.log(`🔐 canUserSearch: email=${email}, count=${data.searchCount}, limit=${SEARCH_LIMIT}`);
  return data.searchCount < SEARCH_LIMIT;
}

export function getRemainingSearches(email: string, name: string): number {
  const data = getUserData(email, name);
  return Math.max(0, SEARCH_LIMIT - data.searchCount);
}

export function recordSearch(
  email: string,
  name: string,
  productType: string,
  keyword: string
): void {
  // Always read fresh from localStorage
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

  saveData(data);
  
  console.log(`✅ recordSearch: email=${email}, newCount=${data.searchCount}`);
}

export function getSearchLimit(): number {
  return SEARCH_LIMIT;
}

export function resetUserData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
import { secureRandomInt } from "./password.js";

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Melissa", "George", "Deborah",
  "Timothy", "Stephanie", "Ronald", "Rebecca", "Edward", "Sharon", "Jason", "Laura",
  "Jeffrey", "Cynthia", "Ryan", "Kathleen", "Jacob", "Amy", "Gary", "Angela",
  "Nicholas", "Shirley", "Eric", "Anna", "Jonathan", "Brenda", "Stephen", "Pamela",
  "Larry", "Emma", "Justin", "Nicole", "Scott", "Helen", "Brandon", "Samantha",
  "Benjamin", "Katherine", "Samuel", "Christine", "Gregory", "Debra", "Alexander", "Rachel",
  "Patrick", "Carolyn", "Frank", "Janet", "Raymond", "Maria", "Jack", "Heather",
  "Dennis", "Diane", "Jerry", "Ruth", "Tyler", "Julie", "Aaron", "Olivia",
  "Jose", "Joyce", "Adam", "Virginia", "Nathan", "Victoria", "Henry", "Kelly",
  "Douglas", "Lauren", "Zachary", "Christina", "Peter", "Joan", "Kyle", "Evelyn",
  "Walter", "Judith", "Ethan", "Megan", "Jeremy", "Cheryl", "Harold", "Andrea",
  "Keith", "Hannah", "Christian", "Martha", "Roger", "Jacqueline", "Noah", "Frances",
  "Gerald", "Gloria", "Carl", "Ann", "Terry", "Teresa", "Sean", "Kathryn",
  "Austin", "Sara", "Arthur", "Janice", "Lawrence", "Jean", "Jesse", "Alice",
  "Dylan", "Madison", "Bryan", "Doris", "Joe", "Abigail", "Jordan", "Julia",
  "Billy", "Judy", "Bruce", "Grace", "Albert", "Denise", "Willie", "Amber",
  "Gabriel", "Marilyn", "Logan", "Beverly", "Alan", "Danielle", "Juan", "Theresa",
  "Wayne", "Sophia", "Roy", "Marie", "Ralph", "Diana", "Randy", "Brittany",
  "Eugene", "Natalie", "Vincent", "Isabella", "Russell", "Charlotte", "Elijah", "Rose",
  "Louis", "Alexis", "Bobby", "Kayla", "Philip", "Lori", "Johnny", "Zoe",
  "Bradley", "Allison", "Mason", "Savannah", "Lucas", "Arianna", "Liam", "Chloe",
  "Caleb", "Brooklyn", "Owen", "Claire", "Connor", "Lily", "Evan", "Audrey",
  "Hunter", "Lucy", "Isaac", "Leah", "Julian", "Naomi", "Cameron", "Maya",
  "Dominic", "Stella", "Adrian", "Hazel", "Nolan", "Violet", "Miles", "Aurora",
  "Cooper", "Sophie", "Carson", "Elena", "Colton", "Ruby", "Asher", "Eva"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
  "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
  "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young",
  "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker",
  "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy",
  "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey",
  "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
  "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza",
  "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers",
  "Long", "Ross", "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell",
  "Sullivan", "Bell", "Coleman", "Butler", "Henderson", "Barnes", "Gonzales", "Fisher",
  "Vasquez", "Simmons", "Romero", "Jordan", "Patterson", "Alexander", "Hamilton", "Graham",
  "Reynolds", "Griffin", "Wallace", "Moreno", "West", "Cole", "Hayes", "Bryant",
  "Herrera", "Gibson", "Ellis", "Tran", "Medina", "Aguilar", "Stevens", "Murray",
  "Ford", "Castro", "Marshall", "Owens", "Harrison", "Fernandez", "McDonald", "Woods",
  "Washington", "Kennedy", "Wells", "Vargas", "Henry", "Chen", "Freeman", "Webb",
  "Tucker", "Guzman", "Burns", "Crawford", "Olson", "Simpson", "Porter", "Hunter",
  "Gordon", "Mendez", "Silva", "Shaw", "Snyder", "Mason", "Dixon", "Munoz",
  "Hunt", "Hicks", "Holmes", "Palmer", "Wagner", "Black", "Robertson", "Boyd",
  "Rose", "Stone", "Salazar", "Fox", "Warren", "Mills", "Meyer", "Rice",
  "Schmidt", "Garza", "Daniels", "Ferguson", "Nichols", "Stephens", "Soto", "Weaver",
  "Ryan", "Gardner", "Payne", "Grant", "Dunn", "Kelley", "Spencer", "Hawkins",
  "Arnold", "Pierce", "Vazquez", "Hansen", "Peters", "Santos", "Hart", "Bradley",
  "Knight", "Elliott", "Cunningham", "Duncan", "Armstrong", "Hudson", "Carroll", "Lane",
  "Riley", "Andrews", "Alvarado", "Ray", "Delgado", "Berry", "Perkins", "Hoffman",
  "Johnston", "Matthews", "Pena", "Richards", "Contreras", "Willis", "Carpenter", "Lawrence",
  "Sandoval", "Guerrero", "George", "Chapman", "Rios", "Estrada", "Ortega", "Watkins",
  "Greene", "Nunez", "Wheeler", "Valdez", "Harper", "Burke", "Larson", "Santiago"
];

function titleCasePart(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || /\s/.test(trimmed) || !/^[A-Za-z][A-Za-z'-]*$/.test(trimmed)) return null;
  return trimmed
    .toLowerCase()
    .replace(/(^|[-'])[a-z]/g, (match) => match.toUpperCase());
}

function builtinParts() {
  const first = FIRST_NAMES[secureRandomInt(FIRST_NAMES.length)];
  const last = LAST_NAMES[secureRandomInt(LAST_NAMES.length)];
  return { first, last };
}

export async function generateUsName({ timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://randomuser.me/api/?nat=us&inc=name&noinfo=1", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const onlineFirst = titleCasePart(data?.results?.[0]?.name?.first);
    const onlineLast = titleCasePart(data?.results?.[0]?.name?.last);
    if (!onlineFirst || !onlineLast) throw new Error("在线姓名格式无效");
    const local = builtinParts();
    const useOnlineFirst = secureRandomInt(2) === 0;
    const first = useOnlineFirst ? onlineFirst : local.first;
    const last = useOnlineFirst ? local.last : onlineLast;
    return { fullName: `${first} ${last}`, source: "mixed" };
  } catch {
    const local = builtinParts();
    return { fullName: `${local.first} ${local.last}`, source: "mixed" };
  } finally {
    clearTimeout(timer);
  }
}

export function generateBuiltinName() {
  const local = builtinParts();
  return { fullName: `${local.first} ${local.last}`, source: "mixed" };
}

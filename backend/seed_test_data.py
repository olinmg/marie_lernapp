"""
Seed script: inserts synthetic cards + study_events spanning the last 7 days.
Run inside the backend container:
  docker compose exec backend python seed_test_data.py
"""
import sqlite3
import uuid
import random
from datetime import datetime, timedelta, timezone

DB_PATH = "/data/flashlearn.db"

now = datetime.now(timezone.utc)

# ---------- synthetic cards ----------

CARDS = [
    {
        "question": "What is the powerhouse of the cell?",
        "answers": [
            ("Mitochondria", True, "Mitochondria generate most of the cell's ATP."),
            ("Nucleus", False, "The nucleus stores DNA but doesn't produce energy."),
            ("Ribosome", False, "Ribosomes synthesise proteins."),
            ("Golgi apparatus", False, "The Golgi packages proteins for transport."),
        ],
        "difficulty": "normal",
        "source_ref": "Page 12",
        "created_days_ago": 7,
    },
    {
        "question": "Which data structure uses FIFO ordering?",
        "answers": [
            ("Queue", True, "Queues follow First-In-First-Out."),
            ("Stack", False, "Stacks follow LIFO."),
            ("Tree", False, "Trees are hierarchical."),
            ("Hash Map", False, "Hash maps offer key-value access."),
        ],
        "difficulty": "normal",
        "source_ref": "Page 34",
        "created_days_ago": 6,
    },
    {
        "question": "What is the derivative of sin(x)?",
        "answers": [
            ("cos(x)", True, "The derivative of sin(x) is cos(x)."),
            ("-cos(x)", False, None),
            ("sin(x)", False, None),
            ("-sin(x)", False, None),
        ],
        "difficulty": "hard",
        "source_ref": "Page 8",
        "created_days_ago": 6,
    },
    {
        "question": "Which protocol operates at the transport layer?",
        "answers": [
            ("TCP", True, "TCP is a transport-layer protocol."),
            ("HTTP", False, "HTTP is application-layer."),
            ("IP", False, "IP is network-layer."),
            ("Ethernet", False, "Ethernet is data-link layer."),
        ],
        "difficulty": "normal",
        "source_ref": "Page 55",
        "created_days_ago": 5,
    },
    {
        "question": "What is the time complexity of binary search?",
        "answers": [
            ("O(log n)", True, "Binary search halves the search space each step."),
            ("O(n)", False, "That's linear search."),
            ("O(n log n)", False, "That's typical of merge sort."),
            ("O(1)", False, "That would be constant time."),
        ],
        "difficulty": "hard",
        "source_ref": "Page 41",
        "created_days_ago": 5,
    },
    {
        "question": "In which year did World War II end?",
        "answers": [
            ("1945", True, "WWII ended with Japan's surrender in 1945."),
            ("1944", False, None),
            ("1946", False, None),
            ("1943", False, None),
        ],
        "difficulty": "normal",
        "source_ref": "Page 3",
        "created_days_ago": 4,
    },
    {
        "question": "What does the Krebs cycle produce?",
        "answers": [
            ("ATP, NADH, FADH2 and CO2", True, "All four are products of the cycle."),
            ("Only ATP", False, "ATP is just one product."),
            ("Glucose", False, "Glucose is consumed, not produced."),
            ("Oxygen", False, "Oxygen is consumed in the ETC, not produced here."),
        ],
        "difficulty": "extreme",
        "source_ref": "Page 18",
        "created_days_ago": 4,
    },
    {
        "question": "Which sorting algorithm has worst-case O(n²)?",
        "answers": [
            ("Quick Sort", True, "Quicksort degrades to O(n²) with bad pivots."),
            ("Merge Sort", False, "Merge sort is always O(n log n)."),
            ("Heap Sort", False, "Heap sort is always O(n log n)."),
            ("Radix Sort", False, "Radix sort is O(nk)."),
        ],
        "difficulty": "hard",
        "source_ref": "Page 47",
        "created_days_ago": 3,
    },
    {
        "question": "What is the chemical formula for water?",
        "answers": [
            ("H2O", True, "Water is two hydrogen atoms and one oxygen."),
            ("CO2", False, "That is carbon dioxide."),
            ("NaCl", False, "That is table salt."),
            ("O2", False, "That is molecular oxygen."),
        ],
        "difficulty": "normal",
        "source_ref": "Page 1",
        "created_days_ago": 2,
    },
    {
        "question": "Which amendment guarantees free speech in the US?",
        "answers": [
            ("First Amendment", True, "The First Amendment protects freedom of speech."),
            ("Second Amendment", False, "That covers the right to bear arms."),
            ("Fourth Amendment", False, "That protects against unreasonable searches."),
            ("Fifth Amendment", False, "That covers due process and self-incrimination."),
        ],
        "difficulty": "normal",
        "source_ref": "Page 22",
        "created_days_ago": 2,
    },
    {
        "question": "What is the big-O of inserting into a balanced BST?",
        "answers": [
            ("O(log n)", True, "Balanced trees maintain logarithmic height."),
            ("O(n)", False, "Only in a degenerate (unbalanced) tree."),
            ("O(1)", False, "Insertion is not constant time."),
            ("O(n²)", False, "No standard BST operation is quadratic."),
        ],
        "difficulty": "professor",
        "source_ref": "Page 50",
        "created_days_ago": 1,
    },
    {
        "question": "What does DNS stand for?",
        "answers": [
            ("Domain Name System", True, "DNS resolves domain names to IP addresses."),
            ("Data Network Service", False, None),
            ("Digital Name Server", False, None),
            ("Domain Node System", False, None),
        ],
        "difficulty": "normal",
        "source_ref": "Page 60",
        "created_days_ago": 0,
    },
]

# ---------- study event schedule ----------
# We'll simulate realistic studying: each card gets 1-4 answer attempts on
# random hours from its creation day through today, with a mix of
# correct/wrong results. The last attempt dictates last_result.

random.seed(42)


def rand_hour():
    """Random hour offset within a day (8am–23pm study window)."""
    return timedelta(hours=random.randint(8, 23), minutes=random.randint(0, 59))


def generate_events(card_id, created_days_ago, difficulty):
    """Return list of (answered_at, is_correct) tuples."""
    events = []
    start_day = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=created_days_ago)

    # Probability of getting it right depends on difficulty
    correct_prob = {"normal": 0.75, "hard": 0.55, "extreme": 0.35, "professor": 0.45}[difficulty]

    # Decide how many study sessions (1–5)
    n_sessions = random.randint(1, min(5, created_days_ago + 1))

    # Pick random days within the range [created_day .. today]
    possible_days = list(range(created_days_ago + 1))  # 0 = today offset
    session_day_offsets = sorted(random.sample(possible_days, min(n_sessions, len(possible_days))))

    for day_offset in session_day_offsets:
        day = start_day + timedelta(days=(created_days_ago - day_offset))
        t = day + rand_hour()
        if t > now:
            t = now - timedelta(minutes=random.randint(1, 60))
        is_correct = random.random() < correct_prob
        events.append((t, is_correct))

    return events


# ---------- insert into DB ----------

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Ensure tables exist (they should from app startup)
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='study_events'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE IF NOT EXISTS study_events (
            id VARCHAR(36) PRIMARY KEY,
            card_id VARCHAR(36) NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            is_correct BOOLEAN NOT NULL,
            answered_at DATETIME NOT NULL
        )
    """)

turn_counter_bump = 0

for card_def in CARDS:
    card_id = str(uuid.uuid4())
    created_at = (
        now - timedelta(days=card_def["created_days_ago"])
    ).replace(hour=9, minute=0, second=0, microsecond=0)

    events = generate_events(card_id, card_def["created_days_ago"], card_def["difficulty"])

    # Compute legacy stats from events
    correct_total = sum(1 for _, c in events if c)
    wrong_total = len(events) - correct_total
    last_result = None
    if events:
        last_result = "correct" if events[-1][1] else "wrong"

    # SRS state — simplified: repetitions = correct streak from end
    reps = 0
    for _, c in reversed(events):
        if c:
            reps += 1
        else:
            break
    interval = max(1, reps * 3)
    ease_factor = round(2.5 - (wrong_total * 0.1), 2)
    ease_factor = max(1.3, ease_factor)
    lapses = wrong_total

    # Insert card
    cur.execute(
        """INSERT INTO cards
           (id, question, source_ref, difficulty, correct, wrong, document_id,
            created_at, "interval", repetitions, ease_factor, lapses,
            last_reviewed_at, last_result)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)""",
        (
            card_id,
            card_def["question"],
            card_def["source_ref"],
            card_def["difficulty"],
            correct_total,
            wrong_total,
            created_at.strftime("%Y-%m-%d %H:%M:%S"),
            interval,
            reps,
            ease_factor,
            lapses,
            turn_counter_bump,
            last_result,
        ),
    )

    # Insert answers
    for text, is_correct, explanation in card_def["answers"]:
        cur.execute(
            """INSERT INTO answers (id, text, is_correct, explanation, card_id)
               VALUES (?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), text, int(is_correct), explanation, card_id),
        )

    # Insert study events
    for answered_at, is_correct in events:
        cur.execute(
            """INSERT INTO study_events (id, card_id, is_correct, answered_at)
               VALUES (?, ?, ?, ?)""",
            (
                str(uuid.uuid4()),
                card_id,
                int(is_correct),
                answered_at.strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )
        turn_counter_bump += 1

# Update global turn counter
cur.execute("UPDATE global_state SET turn_counter = turn_counter + ?", (turn_counter_bump,))

conn.commit()

# Summary
total_cards = cur.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
total_events = cur.execute("SELECT COUNT(*) FROM study_events").fetchone()[0]
print(f"Seeded {len(CARDS)} cards with study history.")
print(f"DB now has {total_cards} cards and {total_events} study events.")

conn.close()

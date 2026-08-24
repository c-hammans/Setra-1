import type { Exercise } from "@/lib/setra/types";

type ExerciseGroup = { group: string; names: string[] };

const requestedExerciseGroups: ExerciseGroup[] = [
  { group: "Chest", names: [
    "Assisted Dip", "Band-Assisted Bench Press", "Bar Dip", "Bench Press", "Bench Press Against Band", "Board Press", "Cable Chest Press", "Clap Push-Up", "Close-Grip Bench Press", "Close-Grip Feet-Up Bench Press", "Cobra Push-Up", "Decline Bench Press", "Decline Push-Up", "Dumbbell Chest Fly", "Dumbbell Chest Press", "Dumbbell Decline Chest Press", "Dumbbell Floor Press", "Dumbbell Pullover", "Feet-Up Bench Press", "Floor Press", "Incline Bench Press", "Incline Dumbbell Press", "Incline Push-Up", "Kettlebell Floor Press", "Kneeling Incline Push-Up", "Kneeling Push-Up", "Machine Chest Fly", "Machine Chest Press", "Medicine Ball Chest Pass", "Pec Deck", "Pin Bench Press", "Plank to Push-Up", "Push-Up", "Push-Up Against Wall", "Push-Ups With Feet in Rings", "Resistance Band Chest Fly", "Ring Dip", "Seated Cable Chest Fly", "Smith Machine Bench Press", "Smith Machine Incline Bench Press", "Smith Machine Reverse Grip Bench Press", "Standing Cable Chest Fly", "Standing Resistance Band Chest Fly",
  ] },
  { group: "Shoulders", names: [
    "Arnold Press", "Band External Shoulder Rotation", "Band Internal Shoulder Rotation", "Band Pull-Apart", "Banded Face Pull", "Barbell Front Raise", "Barbell Rear Delt Row", "Barbell Upright Row", "Behind the Neck Press", "Cable Internal Shoulder Rotation", "Cable External Shoulder Rotation", "Cable Front Raise", "Cable Lateral Raise", "Cable Rear Delt Row", "Cuban Press", "Devils Press", "Dumbbell Front Raise", "Dumbbell Horizontal Internal Shoulder Rotation", "Dumbbell Horizontal External Shoulder Rotation", "Dumbbell Lateral Raise", "Dumbbell Rear Delt Row", "Dumbbell Shoulder Press", "Face Pull", "Front Hold", "Handstand Push-Up", "Jerk", "Kettlebell Halo", "Kettlebell Press", "Kettlebell Push Press", "Landmine Press", "Lying Dumbbell External Shoulder Rotation", "Lying Dumbbell Internal Shoulder Rotation", "Machine Lateral Raise", "Machine Shoulder Press", "Monkey Row", "One-Arm Landmine Press", "Overhead Press", "Plate Front Raise", "Poliquin Raise", "Power Jerk", "Push Press", "Resistance Band Lateral Raise", "Reverse Cable Flyes", "Reverse Dumbbell Flyes", "Reverse Dumbbell Flyes on Incline Bench", "Reverse Machine Fly", "Seated Dumbbell Shoulder Press", "Seated Barbell Overhead Press", "Seated Kettlebell Press", "Seated Smith Machine Shoulder Press", "Smith Machine Landmine Press", "Snatch Grip Behind the Neck Press", "Squat Jerk", "Split Jerk", "Turkish Get-Up", "Wall Walk", "Z Press",
  ] },
  { group: "Biceps", names: [
    "Barbell Curl", "Barbell Preacher Curl", "Bayesian Curl", "Bodyweight Curl", "Cable Crossover Bicep Curl", "Cable Curl With Bar", "Cable Curl With Rope", "Concentration Curl", "Drag Curl", "Dumbbell Curl", "Dumbbell Preacher Curl", "EZ Curl", "Hammer Curl", "Incline Dumbbell Curl", "Kettlebell Curl", "Lying Bicep Cable Curl on Bench", "Lying Bicep Cable Curl on Floor", "Machine Bicep Curl", "Overhead Cable Curl", "Reverse Barbell Curl", "Reverse Dumbbell Curl", "Resistance Band Curl", "Spider Curl", "Zottman Curl",
  ] },
  { group: "Triceps", names: [
    "Barbell Standing Triceps Extension", "Barbell Incline Triceps Extension", "Barbell Lying Triceps Extension", "Bench Dip", "Crossbody Cable Triceps Extension", "Close-Grip Push-Up", "Dumbbell Lying Triceps Extension", "Dumbbell Standing Triceps Extension", "EZ Bar Lying Triceps Extension", "Machine Overhead Triceps Extension", "Overhead Cable Triceps Extension (Lower Position)", "Overhead Cable Triceps Extension (Upper Position)", "Smith Machine Skull Crushers", "Tate Press", "Tricep Bodyweight Extension", "Tricep Pushdown With Bar", "Tricep Pushdown With Rope",
  ] },
  { group: "Quads", names: [
    "Air Squat", "Barbell Hack Squat", "Barbell Lunge", "Barbell Walking Lunge", "Belt Squat", "Body Weight Lunge", "Box Jump", "Box Squat", "Bulgarian Split Squat", "Chair Squat", "Curtsy Lunge", "Depth Jump", "Dumbbell Lunge", "Dumbbell Walking Lunge", "Dumbbell Squat", "Front Squat", "Goblet Squat", "Ground to Overhead", "Hack Squat Machine", "Half Air Squat", "Jump Squat", "Jumping Lunge", "Kettlebell Front Squat", "Kettlebell Thrusters", "Landmine Hack Squat", "Landmine Squat", "Lateral Bound", "Leg Extension", "Leg Press", "One-Legged Leg Extension", "Pause Squat", "Pendulum Squat", "Pin Squat", "Pistol Squat", "Poliquin Step-Up", "Prisoner Get Up", "Reverse Barbell Lunge", "Reverse Body Weight Lunge", "Reverse Dumbbell Lunge", "Reverse Nordic", "Safety Bar Squat", "Shallow Body Weight Lunge", "Side Lunges (Bodyweight)", "Smith Machine Bulgarian Split Squat", "Smith Machine Front Squat", "Smith Machine Lunge", "Smith Machine Squat", "Sumo Squat", "Squat", "Standing Cable Leg Extension", "Step Up", "Vertical Leg Press", "Zercher Squat", "Zombie Squat",
  ] },
  { group: "Hamstrings", names: [
    "Bodyweight Leg Curl", "Glute Ham Raise", "Leg Curl On Ball", "Lying Leg Curl", "Nordic Hamstring Eccentric", "One-Legged Lying Leg Curl", "One-Legged Seated Leg Curl", "Romanian Deadlift", "Seated Leg Curl", "Smith Machine Romanian Deadlift", "Standing Leg Curl",
  ] },
  { group: "Hip Flexors", names: ["Banded Hip March", "Standing Hip Flexor Raise"] },
  { group: "Adductors", names: ["Cable Machine Hip Adduction", "Hip Adduction Against Band", "Hip Adduction Machine", "Long Lever Copenhagen Hold", "Short Lever Copenhagen Hold"] },
  { group: "Tibialis", names: ["Heel Walk", "Kettlebell Tibialis Raise", "Tibialis Band Pull", "Tibialis Raise"] },
  { group: "Back", names: [
    "Assisted Chin-Up", "Assisted Pull-Up", "Back Extension", "Banded Muscle-Up", "Barbell Row", "Block Clean", "Block Snatch", "Cable Close Grip Seated Row", "Cable Wide Grip Seated Row", "Chest-Supported Dumbbell Row", "Chest to Bar", "Chin-Up", "Clean", "Clean and Jerk", "Close-Grip Chin-Up", "Close-Grip Lat Pulldown", "Deadlift", "Deficit Deadlift", "Dumbbell Deadlift", "Dumbbell Row", "Floor Back Extension", "Good Morning", "Gorilla Row", "Hang Clean", "Hang Power Clean", "Hang Power Snatch", "Hang Snatch", "Inverted Row", "Inverted Row with Underhand Grip", "Jefferson Curl", "Jumping Muscle-Up", "Kettlebell Clean", "Kettlebell Clean & Jerk", "Kettlebell Clean & Press", "Kettlebell Row", "Kettlebell Snatch", "Kettlebell Swing", "Kroc Row", "Lat Pulldown With Neutral Grip", "Lat Pulldown With Pronated Grip", "Lat Pulldown With Supinated Grip", "Machine Lat Pulldown", "Muscle-Up (Bar)", "Muscle-Up (Rings)", "Neutral Close-Grip Lat Pulldown", "One-Handed Cable Row", "One-Handed Kettlebell Swing", "One-Handed Lat Pulldown", "Pause Deadlift", "Pendlay Row", "Power Clean", "Power Snatch", "Pull-Up", "Pull-Up With a Neutral Grip", "Rack Pull", "Renegade Row", "Rope Pulldown", "Ring Pull-Up", "Ring Row", "Scap Pull-Up", "Seal Row", "Seated Machine Row", "Single Leg Deadlift with Kettlebell", "Smith Machine Deadlift", "Smith Machine One-Handed Row", "Snatch", "Snatch Grip Deadlift", "Stiff-Legged Deadlift", "Straight Arm Lat Pulldown", "Sumo Deadlift", "Superman Raise", "T-Bar Row", "Towel Row", "Trap Bar Deadlift With High Handles", "Trap Bar Deadlift With Low Handles",
  ] },
  { group: "Traps", names: ["Barbell Shrug", "Dumbbell Shrug"] },
  { group: "Glutes", names: [
    "Banded Side Kicks", "Cable Glute Kickback", "Cable Pull Through", "Cable Machine Hip Abduction", "Clamshells", "Cossack Squat", "Death March with Dumbbells", "Donkey Kicks", "Dumbbell Romanian Deadlift", "Dumbbell Frog Pumps", "Fire Hydrants", "Frog Pumps", "Glute Bridge", "Hip Abduction Against Band", "Hip Abduction Machine", "Hip Thrust", "Hip Thrust Machine", "Hip Thrust With Band Around Knees", "Kettlebell Windmill", "Lateral Walk With Band", "Machine Glute Kickbacks", "One-Legged Glute Bridge", "One-Legged Hip Thrust", "Reverse Hyperextension", "Romanian Deadlift", "Smith Machine Hip Thrust", "Single Leg Romanian Deadlift", "Standing Hip Abduction Against Band", "Standing Glute Kickback in Machine", "Standing Glute Push Down", "Step Up",
  ] },
  { group: "Core", names: [
    "Ball Slams", "Bicycle Crunch", "Cable Crunch", "Captain’s Chair Knee Raise", "Captain’s Chair Leg Raise", "Copenhagen Plank", "Core Twist", "Crunch", "Dead Bug", "Dead Bug With Dumbbells", "Dragon Flag", "Hanging Knee Raise", "Hanging Leg Raise", "Hanging Sit-Up", "Hollow Body Crunch", "Hollow Hold", "Jackknife Sit-Up", "Kettlebell Plank Pull Through", "Kneeling Ab Wheel Roll-Out", "Kneeling Plank", "L-Sit", "Lying Leg Raise", "Machine Crunch", "Mountain Climbers", "Pallof Press", "Plank", "Plank with Leg Lifts", "Plank with Shoulder Taps", "Sit-Up", "Weighted Plank",
  ] },
  { group: "Obliques", names: [
    "Dumbbell Side Bend", "Dynamic Side Plank", "Hanging Windshield Wiper", "High to Low Wood Chop with Band", "High to Low Wood Chop with Cable", "Horizontal Wood Chop with Band", "Horizontal Wood Chop with Cable", "Kneeling Side Plank", "Landmine Rotation", "Low to High Wood Chop with Band", "Low to High Wood Chop with Cable", "Lying Windshield Wiper", "Lying Windshield Wiper with Bent Knees", "Oblique Crunch", "Oblique Sit-Up", "Side Plank",
  ] },
  { group: "Calves", names: ["Barbell Standing Calf Raise", "Barbell Seated Calf Raise", "Calf Raise in Leg Press", "Donkey Calf Raise", "Eccentric Heel Drop", "Heel Raise", "Seated Calf Raise", "Standing Calf Raise"] },
  { group: "Forearms", names: [
    "Barbell Wrist Curl", "Barbell Wrist Curl Behind the Back", "Bar Hang", "Dumbbell Wrist Curl", "Farmers Walk", "Fat Bar Deadlift", "Gripper", "One-Handed Bar Hang", "Plate Pinch", "Plate Wrist Curl", "Towel Pull-Up", "Wrist Roller", "Barbell Wrist Extension", "Dumbbell Wrist Extension",
  ] },
  { group: "Neck", names: ["Lying Neck Curl", "Lying Neck Extension", "Prone Neck Bridge", "Supine Neck Bridge"] },
];

export const exerciseNameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const exerciseId = (name: string) => name
  .normalize("NFKD")
  .replace(/[’']/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .toLowerCase();

const inferEquipment = (name: string): string => {
  const value = name.toLowerCase();
  if (value.includes("smith machine")) return "Smith Machine";
  if (value.includes("trap bar")) return "Trap Bar";
  if (value.includes("safety bar")) return "Safety Bar";
  if (value.includes("ez bar") || value === "ez curl") return "EZ Bar";
  if (value.includes("resistance band") || /\bband\b/.test(value) || value.includes("band-") || value.includes("banded")) return "Resistance Band";
  if (value.includes("cable") || value.includes("pulldown") || value.includes("pushdown")) return "Cable";
  if (value.includes("dumbbell") || value.includes("devils press") || value.includes("death march")) return "Dumbbell";
  if (value.includes("kettlebell")) return "Kettlebell";
  if (value.includes("landmine")) return "Landmine";
  if (value.includes("machine") || value.includes("pec deck") || value.includes("leg press") || value.includes("pendulum squat")) return "Machine";
  if (value.includes("ring")) return "Gymnastic Rings";
  if (value.includes("medicine ball") || value.includes("ball slam")) return "Medicine Ball";
  if (value.includes("plate")) return "Plate";
  if (value.includes("barbell") || value === "ground to overhead" || /(^| )(bench press|board press|floor press|front squat|overhead press|pause squat|pin squat|romanian deadlift|squat|deadlift|good morning|pendlay row|rack pull|seal row|snatch|clean|jerk|push press|z press|zercher squat|zombie squat)$/.test(value)) return "Barbell";
  if (value.includes("assisted")) return "Assisted";
  if (value.includes("belt squat")) return "Belt Squat Machine";
  if (value.includes("farmers walk")) return "Dumbbell";
  if (value.includes("wrist roller") || value.includes("gripper")) return "Other";
  return "Bodyweight";
};

export const expandedExerciseCatalogue: Exercise[] = requestedExerciseGroups.flatMap(({ group, names }) =>
  names.map(name => ({ id: exerciseId(name), name, group, equipment: inferEquipment(name) })),
);

export const mergeExerciseCatalogues = (...catalogues: Exercise[][]): Exercise[] => {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  return catalogues.flat().filter(exercise => {
    const nameKey = exerciseNameKey(exercise.name);
    if (seenIds.has(exercise.id) || seenNames.has(nameKey)) return false;
    seenIds.add(exercise.id);
    seenNames.add(nameKey);
    return true;
  });
};

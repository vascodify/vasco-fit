## 1. Visualization & Analytics

Analytics are limited to two core, highly flexible visualization patterns to uncover correlations without creating a messy dashboard:

1. **The "Overlay" Correlation Chart:**
   * A single interactive line chart with two dropdowns (Metric A, Metric B).
   * Plots two different exercises/metrics on a normalized dual-axis (e.g., comparing "False-Grip Hang Duration" against "Muscle-Up Transition Hold").

2. **Color-Coded Progression Lines:**
   * Y-Axis represents the Primary Metric (e.g., Hold Time in seconds).
   * Data points (dots) use color or size to represent the **Modifier** (e.g., Band thickness, Form quality rating).
   * Allows visualization of nuanced progression (e.g., time decreases, but band assistance also decreases).

3. **Contextual Modifiers:**
   * Session tags (Fresh, Sore, Heavy) lightly tint the chart background or data points to factor in recovery without requiring a separate widget.

## 2. Data Architecture (Blueprint & Instance Model)

The database utilizes a decoupled NoSQL/JSON structure to separate *what is being measured* from *the logging event*.

### Schema Structure

```json
{
  "exercises": [
    {
      "id": "String (Unique ID)",
      "name": "String",
      "is_active_focus": "Boolean",
      "metrics": [
        {
          "name": "String (e.g., Time Under Tension, Weight, Reps)",
          "type": "String (e.g., duration, count, load)",
          "unit": "String (e.g., seconds, reps, kg/lbs)"
        }
      ],
      "modifier": {
        "name": "String (e.g., Band Assistance, Form Quality)",
        "type": "String (categorical, scale)",
        "options": "Array or Min/Max values"
      }
    }
  ],
  "logs": [
    {
      "id": "String (Unique ID)",
      "exercise_id": "String (Ref to Blueprint)",
      "timestamp": "ISO 8601 DateTime",
      "metric_values": {
        "metric_name_1": "Number",
        "metric_name_2": "Number (optional)"
      },
      "modifier_value": "String or Number",
      "session_tags": ["Array of Strings"]
    }
  ]
}
```

## 3. Initial Priority Exercise Blueprints

Based on the user's specific targets, the following default blueprints should be seeded into the database. Note that the schema supports single metrics (Time, Reps) as well as compound metrics (Weight + Reps).

1. **Muscle Up Transition Isometrics**
   * **Metrics:** Time (duration / seconds)
   * **Modifier:** Band Assistance (None, Light, Medium, Heavy) OR Form Quality (1-5)

2. **Fat Grip Pullups**
   * **Metrics:** Reps (count)

3. **Weighted Pullups**
   * **Metrics:** Weight (load / kg or lbs) + Reps (count)

4. **Dips**
   * **Metrics:** Reps (count)
   * **Optional Modifier:** Additional Weight (if transitioning to weighted)

5. **Sphinx Pushups**
   * **Metrics:** Reps (count)

6. **Pike Presses**
   * **Metrics:** Reps (count)
   * **Optional Modifier:** Deficit / Range of Motion (Floor, Parallettes, Blocks)

7. **Deadlift**
   * **Metrics:** Weight (load) + Reps (count)

8. **Squat**
   * **Metrics:** Weight (load) + Reps (count)
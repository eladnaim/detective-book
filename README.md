# Detective Book Landing Page

דף נחיתה לאיסוף פרטים לחלוקת ספר מתנה, בנוי ב-Next.js עם עיצוב כהה ומסתורי.

## הוראות התקנה והעלאה (Deployment)

הפרויקט מותאם לעבודה עם Vercel ו-Vercel Postgres.

### 1. יצירת פרויקט ב-Vercel
1. העלו את הקוד ל-GitHub/GitLab.
2. פתחו פרויקט חדש ב-Vercel וקשרו את ה-Repository.

### 2. הגדרת מסד נתונים (Database)
1. בדאשבורד של הפרויקט ב-Vercel, לכו ל-**Storage**.
2. לחצו על **Create Database** ובחרו **Postgres**.
3.תנו לו שם (למשל `detective-book-db`) ולחצו Create.
4. לאחר היצירה, Vercel תוסיף אוטומטית את משתני הסביבה (`POSTGRES_URL` וכו').

### 3. יצירת הטבלה
כדי שהטופס יעבוד, יש להריץ את פקודת ה-SQL הבאה בטאב **Data** בדאשבורד של ה-Database ב-Vercel (יש שם אפשרות ל-Query Runner):

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT NOT NULL,
  zip TEXT,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4. הגדרת סיסמת מנהל
1. לכו ל-**Settings** -> **Environment Variables** בפרויקט ב-Vercel.
2. הוסיפו משתנה חדש:
   - **Key**: `ADMIN_PASSWORD`
   - **Value**: (הסיסמה שתרצו, למשל `Secret123`)

## שימוש
- **דף הבית**: המשתמשים ממלאים פרטים.
- **דף ניהול**: גשו ל-`/admin`. הזינו את הסיסמה שהגדרתם. תוכלו לראות את הנרשמים ולהוריד קובץ CSV למשלוח.

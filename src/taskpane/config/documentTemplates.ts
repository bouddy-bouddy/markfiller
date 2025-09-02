export interface DocumentTemplate {
  id: string;
  name: string;
  nameColumn: number;
  numberColumn: number;
  markColumns: {
    fard1?: number;
    fard2?: number;
    fard3?: number;
    activities?: number;
  };
  rowStart: number;
  description: string;
}

export const documentTemplates: DocumentTemplate[] = [
  {
    id: "massar-standard",
    name: "مسار - النموذج القياسي",
    nameColumn: 1, // إسم التلميذ column (may be merged from multiple columns)
    numberColumn: 0, // رقم التلميذ column
    markColumns: {
      // These are النقطة columns under each test header
      fard1: 2, // النقطة column under الفرض الأول
      fard2: 4, // النقطة column under الفرض الثاني
      fard3: 6, // النقطة column under الفرض الثالث
      activities: 8, // النقطة column under الأنشطة
    },
    rowStart: 2, // Data usually starts from row 3 (index 2) in Massar files
    description: "نموذج ورقة العلامات القياسي من منصة مسار - يدعم الأعمدة المدمجة والنقاط تحت كل فرض",
  },
  {
    id: "massar-alternative",
    name: "مسار - نموذج بديل",
    nameColumn: 2, // Alternative name column position
    numberColumn: 0,
    markColumns: {
      fard1: 3, // النقطة column under الفرض الأول
      fard2: 5, // النقطة column under الفرض الثاني
      fard3: 7, // النقطة column under الفرض الثالث
      activities: 9, // النقطة column under الأنشطة
    },
    rowStart: 2,
    description: "نموذج مسار بديل مع ترتيب مختلف للأعمدة",
  },
  {
    id: "custom-school-format",
    name: "نموذج المدرسة",
    nameColumn: 2,
    numberColumn: 0,
    markColumns: {
      fard1: 3,
      fard2: 4,
      activities: 5,
    },
    rowStart: 2,
    description: "النموذج المخصص المستخدم في مدرستنا",
  },
];

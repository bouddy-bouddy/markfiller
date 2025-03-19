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
    nameColumn: 1,
    numberColumn: 0,
    markColumns: {
      fard1: 2,
      fard2: 3,
      fard3: 4,
      activities: 5,
    },
    rowStart: 1,
    description: "نموذج ورقة العلامات القياسي من منصة مسار",
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

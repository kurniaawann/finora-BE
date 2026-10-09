import { prisma } from '../src/config/database.js';
import type { categories_type } from '../src/generated/prisma/enums.js';

interface SystemCategory {
  name: string;
  icon: string;
  color: string;
}

// Ikon memakai nama Material Icons agar langsung bisa dipakai di mobile.
const SYSTEM_CATEGORIES: Record<categories_type, SystemCategory[]> = {
  expense: [
    { name: 'Makanan & Minuman', icon: 'restaurant', color: '#F44336' },
    { name: 'Transportasi', icon: 'directions_car', color: '#2196F3' },
    { name: 'Belanja', icon: 'shopping_bag', color: '#E91E63' },
    { name: 'Tagihan & Utilitas', icon: 'receipt_long', color: '#FF9800' },
    { name: 'Hiburan', icon: 'movie', color: '#9C27B0' },
    { name: 'Perjalanan', icon: 'flight', color: '#00BCD4' },
    { name: 'Kesehatan', icon: 'local_hospital', color: '#4CAF50' },
    { name: 'Pendidikan', icon: 'school', color: '#3F51B5' },
    { name: 'Rumah Tangga', icon: 'home', color: '#795548' },
    { name: 'Perawatan Diri', icon: 'spa', color: '#EC407A' },
    { name: 'Hadiah & Donasi', icon: 'volunteer_activism', color: '#FF5722' },
    { name: 'Lainnya', icon: 'more_horiz', color: '#9E9E9E' },
  ],
  income: [
    { name: 'Gaji', icon: 'payments', color: '#4CAF50' },
    { name: 'Bonus', icon: 'star', color: '#FFC107' },
    { name: 'Usaha', icon: 'storefront', color: '#009688' },
    { name: 'Investasi', icon: 'trending_up', color: '#3F51B5' },
    { name: 'Hadiah', icon: 'redeem', color: '#E91E63' },
    { name: 'Lainnya', icon: 'more_horiz', color: '#9E9E9E' },
  ],
};

/** Idempoten: kategori sistem yang sudah ada (nama + jenis) dilewati. */
const seedSystemCategories = async () => {
  let created = 0;

  for (const [type, categories] of Object.entries(SYSTEM_CATEGORIES) as [
    categories_type,
    SystemCategory[],
  ][]) {
    for (const category of categories) {
      const existing = await prisma.categories.findFirst({
        where: { name: category.name, type, is_system: true },
        select: { id: true },
      });

      if (existing) {
        continue;
      }

      await prisma.categories.create({
        data: {
          ...category,
          type,
          user_id: null,
          parent_id: null,
          is_system: true,
        },
      });

      created++;
    }
  }

  console.log(`Kategori sistem: ${created} dibuat`);
};

try {
  await seedSystemCategories();
} finally {
  await prisma.$disconnect();
}

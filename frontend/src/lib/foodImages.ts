// Mapping of dish categories & names to professional, high-resolution food imagery
export function getFoodImage(name: string, category: string): string {
  const lowerName = name.toLowerCase()
  const lowerCat = category.toLowerCase()

  if (lowerName.includes('biryani')) {
    return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=240&h=240&q=80'
  }
  if (lowerName.includes('dosa') || lowerName.includes('akki roti') || lowerName.includes('buns')) {
    return 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=240&h=240&q=80'
  }
  if (lowerName.includes('thali') || lowerName.includes('meal') || lowerName.includes('rice') || lowerName.includes('bath')) {
    return 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=240&h=240&q=80'
  }
  if (lowerName.includes('idli') || lowerName.includes('vada') || lowerName.includes('poori')) {
    return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=240&h=240&q=80'
  }
  if (lowerName.includes('butter chicken') || lowerName.includes('kebab') || lowerName.includes('kadai') || lowerName.includes('roti') || lowerName.includes('naan')) {
    return 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=240&h=240&q=80'
  }
  if (lowerCat.includes('beverage') || lowerName.includes('coffee') || lowerName.includes('tea')) {
    return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=240&h=240&q=80'
  }
  return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=240&h=240&q=80'
}

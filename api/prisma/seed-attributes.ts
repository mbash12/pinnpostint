import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define attributes for each subcategory
const subcategoryAttributes = {
  // Phones subcategory
  'Phones': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Realme', 'Oppo', 'Vivo', 'Google Pixel', 'Motorola', 'Huawei', 'Sony'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Model',
      type: 'text',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Storage',
      type: 'select',
      options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'],
      isRequired: false,
      order: 3,
    },
    {
      name: 'RAM',
      type: 'select',
      options: ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB'],
      isRequired: false,
      order: 4,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 5,
    },
    {
      name: 'Color',
      type: 'text',
      isRequired: false,
      order: 6,
    },
  ],
  
  // Tablets subcategory
  'Tablets': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Apple', 'Samsung', 'Microsoft', 'Amazon', 'Lenovo', 'Huawei', 'Xiaomi', 'Google Pixel'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Model',
      type: 'text',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Storage',
      type: 'select',
      options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB'],
      isRequired: false,
      order: 3,
    },
    {
      name: 'Screen Size',
      type: 'text',
      isRequired: false,
      order: 4,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 5,
    },
    {
      name: 'Color',
      type: 'text',
      isRequired: false,
      order: 6,
    },
  ],
  
  // Phone & Tablet Accessories subcategory
  'Phone & Tablet Accessories': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Apple', 'Samsung', 'Xiaomi', 'Generic', 'Original', 'Third Party'],
      isRequired: false,
      order: 1,
    },
    {
      name: 'Type',
      type: 'select',
      options: ['Charger', 'Cable', 'Case', 'Screen Protector', 'Headphones', 'Power Bank', 'Mount', 'Stylus'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Compatibility',
      type: 'text',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Photography & Videography subcategory
  'Photography & Videography': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Olympus', 'Panasonic', 'GoPro', 'DJI', 'Sigma'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Type',
      type: 'select',
      options: ['Camera', 'Lens', 'Tripod', 'Drone', 'Action Camera', 'Lighting', 'Audio Equipment', 'Filters', 'Accessories'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Model',
      type: 'text',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Games & Consoles subcategory
  'Games & Consoles': [
    {
      name: 'Platform',
      type: 'select',
      options: ['PlayStation 5', 'PlayStation 4', 'Xbox Series X/S', 'Xbox One', 'Nintendo Switch', 'PC', 'Mobile', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Type',
      type: 'select',
      options: ['Console', 'Game', 'Accessory', 'Controller'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Sealed', 'Like New', 'Good', 'Fair'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Computers & Laptops subcategory
  'Computers & Laptops': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Microsoft', 'Alienware', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Type',
      type: 'select',
      options: ['Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Scanner'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Processor',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'RAM',
      type: 'text',
      isRequired: false,
      order: 4,
    },
    {
      name: 'Storage',
      type: 'text',
      isRequired: false,
      order: 5,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 6,
    },
  ],
  
  // TV, Audio & Accessories subcategory
  'TV, Audio & Accessories': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Philips', 'Onida', 'Videocon', 'Bose', 'JBL', 'Sony', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Type',
      type: 'select',
      options: ['TV', 'Soundbar', 'Speaker', 'Headphones', 'Home Theater', 'Streaming Device', 'Remote', 'Cables'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Size',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Musical Instruments & Accessories subcategory
  'Musical Instruments & Accessories': [
    {
      name: 'Type',
      type: 'select',
      options: ['Guitar', 'Keyboard', 'Piano', 'Drums', 'Violin', 'Flute', 'Harmonica', 'Microphone', 'Amplifier', 'Effects Pedal', 'Sheet Music', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Sports Equipment & Clothing subcategory
  'Sports Equipment & Clothing': [
    {
      name: 'Type',
      type: 'select',
      options: ['Equipment', 'Clothing', 'Footwear', 'Accessories', 'Apparel'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Sport',
      type: 'select',
      options: ['Cricket', 'Football', 'Basketball', 'Tennis', 'Badminton', 'Swimming', 'Cycling', 'Running', 'Yoga', 'Gym', 'Other'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Size',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Bicycles, Scooters & Accessories subcategory
  'Bicycles, Scooters & Accessories': [
    {
      name: 'Type',
      type: 'select',
      options: ['Bicycle', 'Scooter', 'Scooty', 'Parts', 'Accessories'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
    {
      name: 'Size/Wheel',
      type: 'text',
      isRequired: false,
      order: 4,
    },
  ],
  
  // Arts & Crafts subcategory
  'Arts & Crafts': [
    {
      name: 'Type',
      type: 'select',
      options: ['Painting', 'Drawing', 'Craft Supplies', 'Canvas', 'Brushes', 'Sketchbook', 'Sewing', 'Pottery', 'Scrapbooking', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 2,
    },
  ],
  
  // Printed & Digital Books subcategory
  'Printed & Digital Books': [
    {
      name: 'Type',
      type: 'select',
      options: ['Fiction', 'Non-Fiction', 'Academic', 'Magazine', 'Comic', 'Digital', 'Study Material', 'Novel', 'Biography', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Genre',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Collectibles & Hobby Toys subcategory
  'Collectibles & Hobby Toys': [
    {
      name: 'Type',
      type: 'select',
      options: ['Action Figures', 'Dolls', 'Toy Cars', 'Board Games', 'Puzzles', 'Stamps', 'Coins', 'Cards', 'Models', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Age Group',
      type: 'select',
      options: ['0-2 years', '3-5 years', '6-9 years', '10-14 years', '15+ years', 'Adult'],
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Music & Films subcategory
  'Music & Films': [
    {
      name: 'Type',
      type: 'select',
      options: ['CD', 'DVD', 'Vinyl', 'Blu-ray', 'Cassette', 'Digital Media', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Genre',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Sealed', 'Like New', 'Good', 'Fair'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Pets & Pet Accessories subcategory
  'Pets & Pet Accessories': [
    {
      name: 'Type',
      type: 'select',
      options: ['Pet', 'Food', 'Toys', 'Bedding', 'Collar', 'Leash', 'Carrier', 'Grooming', 'Health', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Pet Type',
      type: 'select',
      options: ['Dog', 'Cat', 'Bird', 'Fish', 'Reptile', 'Rodent', 'Other'],
      isRequired: false,
      order: 2,
    },
    {
      name: 'Breed',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Age',
      type: 'text',
      isRequired: false,
      order: 4,
    },
  ],
  
  // Food & Beverages subcategory
  'Food & Beverages': [
    {
      name: 'Type',
      type: 'select',
      options: ['Vegetables', 'Fruits', 'Grains', 'Dairy', 'Meat', 'Beverages', 'Snacks', 'Cooking Oil', 'Spices', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Expiry Date',
      type: 'date',
      isRequired: false,
      order: 3,
    },
  ],
  
  // Furniture & Home Decor subcategory
  'Furniture & Home Decor': [
    {
      name: 'Type',
      type: 'select',
      options: ['Sofa', 'Bed', 'Table', 'Chair', 'Cabinet', 'Decorative Items', 'Lighting', 'Curtains', 'Rugs', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Material',
      type: 'select',
      options: ['Wood', 'Metal', 'Plastic', 'Fabric', 'Glass', 'Other'],
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Garden & Outdoor Needs subcategory
  'Garden & Outdoor Needs': [
    {
      name: 'Type',
      type: 'select',
      options: ['Plants', 'Seeds', 'Tools', 'Fertilizers', 'Pots', 'Gardening Equipment', 'Outdoor Furniture', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Plant Type',
      type: 'select',
      options: ['Flowering', 'Fruit Bearing', 'Ornamental', 'Medicinal', 'Other'],
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Construction Tools & Materials subcategory
  'Construction Tools & Materials': [
    {
      name: 'Type',
      type: 'select',
      options: ['Tools', 'Materials', 'Hardware', 'Electrical', 'Plumbing', 'Safety Equipment', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Home & Kitchen Supplies subcategory
  'Home & Kitchen Supplies': [
    {
      name: 'Type',
      type: 'select',
      options: ['Utensils', 'Cookware', 'Appliances', 'Storage', 'Cleaning Supplies', 'Dining', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Household Electronics subcategory
  'Household Electronics': [
    {
      name: 'Type',
      type: 'select',
      options: ['Kitchen Appliances', 'Laundry', 'Cleaning', 'Climate Control', 'Entertainment', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Women's Fashion subcategory
  'Women\'s Fashion': [
    {
      name: 'Type',
      type: 'select',
      options: ['Top', 'Bottom', 'Dress', 'Saree', 'Kurta', 'Leggings', 'Nightwear', 'Innerwear', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Size',
      type: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Color',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Men's Fashion subcategory
  'Men\'s Fashion': [
    {
      name: 'Type',
      type: 'select',
      options: ['Shirt', 'T-Shirt', 'Jeans', 'Trouser', 'Shorts', 'Jacket', 'Suit', 'Undergarments', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Size',
      type: 'select',
      options: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Color',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Watches subcategory
  'Watches': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Rolex', 'Titan', 'Fossil', 'Casio', 'Timex', 'Seiko', 'Omega', 'Other'],
      isRequired: false,
      order: 1,
    },
    {
      name: 'Type',
      type: 'select',
      options: ['Analog', 'Digital', 'Smart Watch', 'Chronograph', 'Diving', 'Dress', 'Other'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Gender',
      type: 'select',
      options: ['Unisex', 'Male', 'Female', 'Kids'],
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Jewelry subcategory
  'Jewelry': [
    {
      name: 'Type',
      type: 'select',
      options: ['Necklace', 'Earrings', 'Ring', 'Bracelet', 'Anklet', 'Set', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Material',
      type: 'select',
      options: ['Gold', 'Silver', 'Platinum', 'Diamond', 'Pearl', 'Gemstone', 'Alloy', 'Other'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Gender',
      type: 'select',
      options: ['Unisex', 'Male', 'Female', 'Kids'],
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Health, Care & Beauty subcategory
  'Health, Care & Beauty': [
    {
      name: 'Type',
      type: 'select',
      options: ['Skincare', 'Haircare', 'Makeup', 'Fragrance', 'Personal Care', 'Wellness', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Expiry Date',
      type: 'date',
      isRequired: false,
      order: 3,
    },
  ],
  
  // Used Cars subcategory
  'Used Cars': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda', 'Toyota', 'Ford', 'Nissan', 'Renault', 'Volkswagen', 'BMW', 'Mercedes-Benz', 'Audi', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Model',
      type: 'text',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Year',
      type: 'number',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Fuel Type',
      type: 'select',
      options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'],
      isRequired: true,
      order: 4,
    },
    {
      name: 'Transmission',
      type: 'select',
      options: ['Manual', 'Automatic'],
      isRequired: true,
      order: 5,
    },
    {
      name: 'Kilometers Driven',
      type: 'number',
      isRequired: true,
      order: 6,
    },
    {
      name: 'Color',
      type: 'text',
      isRequired: false,
      order: 7,
    },
    {
      name: 'Body Type',
      type: 'select',
      options: ['Sedan', 'Hatchback', 'SUV', 'MUV', 'Luxury', 'Coupe', 'Convertible'],
      isRequired: false,
      order: 8,
    },
  ],
  
  // Accessories subcategory (for cars)
  'Accessories': [
    {
      name: 'Type',
      type: 'select',
      options: ['Interior', 'Exterior', 'Performance', 'Safety', 'Electronics', 'Maintenance', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Car Audio subcategory
  'Car Audio': [
    {
      name: 'Type',
      type: 'select',
      options: ['Speakers', 'Subwoofers', 'Amplifiers', 'Head Units', 'Equalizers', 'Accessories', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Spare Parts subcategory (for cars)
  'Spare Parts': [
    {
      name: 'Type',
      type: 'select',
      options: ['Engine', 'Transmission', 'Suspension', 'Brakes', 'Electrical', 'Body', 'Interior', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Used', 'Refurbished'],
      isRequired: true,
      order: 3,
    },
  ],
  
  // Wheels and Tires subcategory
  'Wheels and Tires': [
    {
      name: 'Type',
      type: 'select',
      options: ['Tires', 'Alloy Wheels', 'Steel Wheels', 'Spare Wheel', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Size',
      type: 'text',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Trucks & Commercial Vehicles subcategory
  'Trucks & Commercial Vehicles': [
    {
      name: 'Type',
      type: 'select',
      options: ['Truck', 'Bus', 'Commercial Van', 'Tractor', 'Tipper', 'Container', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Year',
      type: 'number',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Kilometers Driven',
      type: 'number',
      isRequired: true,
      order: 4,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 5,
    },
  ],
  
  // Used Motorcycles subcategory
  'Used Motorcycles': [
    {
      name: 'Brand',
      type: 'select',
      options: ['Hero', 'Honda', 'Bajaj', 'TVS', 'Yamaha', 'Suzuki', 'Royal Enfield', 'KTM', 'Harley-Davidson', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Model',
      type: 'text',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Year',
      type: 'number',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Engine Capacity',
      type: 'number',
      isRequired: true,
      order: 4,
    },
    {
      name: 'Kilometers Driven',
      type: 'number',
      isRequired: true,
      order: 5,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 6,
    },
  ],
  
  // Helmets subcategory
  'Helmets': [
    {
      name: 'Type',
      type: 'select',
      options: ['Full Face', 'Open Face', 'Half Helmet', 'Modular', 'Off Road', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Size',
      type: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Job Vacancies subcategory
  'Job Vacancies': [
    {
      name: 'Industry',
      type: 'select',
      options: ['IT', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Hospitality', 'Marketing', 'Sales', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Experience Level',
      type: 'select',
      options: ['Fresher', '1-2 Years', '3-5 Years', '5-10 Years', '10+ Years'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Employment Type',
      type: 'select',
      options: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'],
      isRequired: true,
      order: 3,
    },
    {
      name: 'Salary Range',
      type: 'text',
      isRequired: false,
      order: 4,
    },
  ],
  
  // Post Resume subcategory
  'Post Resume': [
    {
      name: 'Resume',
      type: 'file',
      isRequired: true,
      order: 1,
    },
    {
      name: 'Industry',
      type: 'select',
      options: ['IT', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Hospitality', 'Marketing', 'Sales', 'Other'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Experience Level',
      type: 'select',
      options: ['Fresher', '1-2 Years', '3-5 Years', '5-10 Years', '10+ Years'],
      isRequired: true,
      order: 3,
    },
    {
      name: 'Job Type',
      type: 'select',
      options: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Services subcategory
  'Services': [
    {
      name: 'Service Type',
      type: 'select',
      options: ['Home Services', 'Beauty & Wellness', 'Repair & Maintenance', 'Education & Tutoring', 'Transportation', 'Event Services', 'Professional Services', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Experience',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Availability',
      type: 'select',
      options: ['Full-time', 'Part-time', 'Weekends', 'Evenings', 'Flexible'],
      isRequired: false,
      order: 3,
    },
  ],
  
  // Others subcategory (for various categories)
  'Others': [
    {
      name: 'Description',
      type: 'textarea',
      isRequired: false,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: false,
      order: 2,
    },
  ],
  
  // Free Items subcategories
  'Phones & Gadgets (Free)': [
    {
      name: 'Item Type',
      type: 'select',
      options: ['Phone', 'Tablet', 'Laptop', 'Accessories', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 2,
    },
  ],
  
  'Hobbies & Sports (Free)': [
    {
      name: 'Category',
      type: 'select',
      options: ['Sports Equipment', 'Musical Instruments', 'Books', 'Toys', 'Games', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 2,
    },
  ],
  
  'Household Items (Free)': [
    {
      name: 'Category',
      type: 'select',
      options: ['Furniture', 'Kitchen', 'Decor', 'Appliances', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 2,
    },
  ],
  
  'Personal Needs (Free)': [
    {
      name: 'Category',
      type: 'select',
      options: ['Clothing', 'Cosmetics', 'Accessories', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 2,
    },
  ],
  
  'Baby & Child Supplies (Free)': [
    {
      name: 'Category',
      type: 'select',
      options: ['Clothing', 'Toys', 'Furniture', 'Feeding', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 2,
    },
  ],
  
  'Office & Industry (Free)': [
    {
      name: 'Category',
      type: 'select',
      options: ['Equipment', 'Supplies', 'Furniture', 'Tools', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 2,
    },
  ],
  
  // Property subcategories
  'For Sale: Houses & Apartments': [
    {
      name: 'Property Type',
      type: 'select',
      options: ['Apartment', 'Independent House', 'Villa', 'Penthouse', 'Studio', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Area (sq ft)',
      type: 'number',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Bedrooms',
      type: 'number',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Bathrooms',
      type: 'number',
      isRequired: false,
      order: 4,
    },
    {
      name: 'Furnished Status',
      type: 'select',
      options: ['Fully Furnished', 'Semi-Furnished', 'Unfurnished'],
      isRequired: false,
      order: 5,
    },
  ],
  
  'For Rent: Houses & Apartments': [
    {
      name: 'Property Type',
      type: 'select',
      options: ['Apartment', 'Independent House', 'Villa', 'Penthouse', 'Studio', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Area (sq ft)',
      type: 'number',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Bedrooms',
      type: 'number',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Bathrooms',
      type: 'number',
      isRequired: false,
      order: 4,
    },
    {
      name: 'Furnished Status',
      type: 'select',
      options: ['Fully Furnished', 'Semi-Furnished', 'Unfurnished'],
      isRequired: false,
      order: 5,
    },
    {
      name: 'Monthly Rent',
      type: 'number',
      isRequired: true,
      order: 6,
    },
  ],
  
  'Land': [
    {
      name: 'Land Type',
      type: 'select',
      options: ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Area (sq ft)',
      type: 'number',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Purpose',
      type: 'select',
      options: ['Residential Plot', 'Commercial Plot', 'Farm Land', 'Industrial Plot', 'Other'],
      isRequired: false,
      order: 3,
    },
  ],
  
  'Boarding House': [
    {
      name: 'Room Type',
      type: 'select',
      options: ['Single Occupancy', 'Double Occupancy', 'Triple Occupancy', 'Family Room', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Monthly Rent',
      type: 'number',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Facilities Included',
      type: 'textarea',
      isRequired: false,
      order: 3,
    },
  ],
  
  'For Sale: Commercial Buildings': [
    {
      name: 'Building Type',
      type: 'select',
      options: ['Office Space', 'Shop', 'Warehouse', 'Factory', 'Showroom', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Area (sq ft)',
      type: 'number',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Purpose',
      type: 'select',
      options: ['Office', 'Retail', 'Storage', 'Manufacturing', 'Other'],
      isRequired: false,
      order: 3,
    },
  ],
  
  'For Rent: Commercial Buildings': [
    {
      name: 'Building Type',
      type: 'select',
      options: ['Office Space', 'Shop', 'Warehouse', 'Factory', 'Showroom', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Area (sq ft)',
      type: 'number',
      isRequired: true,
      order: 2,
    },
    {
      name: 'Monthly Rent',
      type: 'number',
      isRequired: true,
      order: 3,
    },
    {
      name: 'Purpose',
      type: 'select',
      options: ['Office', 'Retail', 'Storage', 'Manufacturing', 'Other'],
      isRequired: false,
      order: 4,
    },
  ],
  
  // Baby & Child Supplies subcategories
  'Baby & Child Fashion': [
    {
      name: 'Age Group',
      type: 'select',
      options: ['0-6 months', '6-12 months', '1-2 years', '2-4 years', '4-8 years', '8-12 years'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Gender',
      type: 'select',
      options: ['Unisex', 'Male', 'Female'],
      isRequired: false,
      order: 2,
    },
    {
      name: 'Size',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  'Mother & Baby Supplies': [
    {
      name: 'Type',
      type: 'select',
      options: ['Feeding', 'Diapering', 'Bathing', 'Nursery', 'Safety', 'Health', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  'Children\'s Books': [
    {
      name: 'Age Group',
      type: 'select',
      options: ['0-2 years', '3-5 years', '6-9 years', '10-14 years', '15+ years'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Genre',
      type: 'select',
      options: ['Fiction', 'Non-Fiction', 'Educational', 'Picture Books', 'Activity Books', 'Other'],
      isRequired: false,
      order: 2,
    },
    {
      name: 'Language',
      type: 'select',
      options: ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Other'],
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  'Dolls & Children\'s Toys': [
    {
      name: 'Type',
      type: 'select',
      options: ['Dolls', 'Action Figures', 'Puzzles', 'Board Games', 'Educational Toys', 'Outdoor Toys', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Age Group',
      type: 'select',
      options: ['0-2 years', '3-5 years', '6-9 years', '10-14 years', '15+ years'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  'Strollers, Bouncers & Carriers': [
    {
      name: 'Type',
      type: 'select',
      options: ['Stroller', 'Bouncer', 'Carrier', 'Car Seat', 'High Chair', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Age Group',
      type: 'select',
      options: ['Newborn', '6+ months', '12+ months', 'Toddler', 'Universal'],
      isRequired: true,
      order: 2,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 3,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 4,
    },
  ],
  
  // Personal Needs subcategories
  'Customs & Religion': [
    {
      name: 'Type',
      type: 'select',
      options: ['Clothing', 'Accessories', 'Religious Items', 'Books', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Religion/Culture',
      type: 'select',
      options: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'],
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  'Tickets & Vouchers': [
    {
      name: 'Type',
      type: 'select',
      options: ['Movie Tickets', 'Event Tickets', 'Gift Vouchers', 'Coupons', 'Travel Tickets', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Validity',
      type: 'date',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Brand/Company',
      type: 'text',
      isRequired: false,
      order: 3,
    },
  ],
  
  // Office & Industry subcategories
  'Security & Safety Equipment': [
    {
      name: 'Type',
      type: 'select',
      options: ['Cameras', 'Alarms', 'Fire Safety', 'First Aid', 'Protective Gear', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  'Office Equipment & Stationery': [
    {
      name: 'Type',
      type: 'select',
      options: ['Furniture', 'Electronics', 'Stationery', 'Supplies', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  'Business Supplies': [
    {
      name: 'Type',
      type: 'select',
      options: ['Printing', 'Packaging', 'Labels', 'Signage', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
  
  'Machinery & Industrial Needs': [
    {
      name: 'Type',
      type: 'select',
      options: ['Construction', 'Manufacturing', 'Agriculture', 'Mining', 'Other'],
      isRequired: true,
      order: 1,
    },
    {
      name: 'Brand',
      type: 'text',
      isRequired: false,
      order: 2,
    },
    {
      name: 'Condition',
      type: 'select',
      options: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      isRequired: true,
      order: 3,
    },
  ],
};

export async function seedAttributes() {
  console.log('🎛️  Seeding attributes for subcategories...');

  try {
    // Get all subcategories from the database
    const subcategories = await prisma.subcategory.findMany();
    
    if (subcategories.length === 0) {
      console.log('⚠️  No subcategories found. Skipping attribute seeding.');
      return;
    }

    // Process each subcategory
    for (const subcategory of subcategories) {
      // Check if the subcategory has predefined attributes
      const predefinedAttributes = subcategoryAttributes[subcategory.name as keyof typeof subcategoryAttributes];
      
      if (predefinedAttributes) {
        console.log(`   📝 Creating attributes for subcategory: ${subcategory.name}`);
        
        // Create attributes for this subcategory
        for (const attribute of predefinedAttributes) {
          await prisma.attribute.create({
            data: {
              name: attribute.name,
              type: attribute.type,
              options: attribute.options ? attribute.options : undefined,
              subcategoryId: subcategory.id,
              isRequired: attribute.isRequired,
              order: attribute.order,
            }
          });
        }
      } else {
        console.log(`   ⚠️  No predefined attributes for subcategory: ${subcategory.name}. Consider adding them to the configuration.`);
      }
    }

    // Count total attributes created
    const totalAttributes = await prisma.attribute.count();
    console.log(`✅ Successfully created attributes for subcategories. Total attributes: ${totalAttributes}`);
  } catch (error) {
    console.error('❌ Error seeding attributes:', error);
    throw error;
  }
}

// Run the seeder if this file is executed directly
if (require.main === module) {
  seedAttributes()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
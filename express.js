const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5500;
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Parse JSON bodies
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'] // Add your domain if needed
}));

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'pinky2406',
  database: 'food'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Route to add item to cart
app.post('/add-to-cart', (req, res) => {
  console.log('Received request to /add-to-cart');
  const itemId = req.body.itemId;
  const userId = 123; // Placeholder user ID

  if (!itemId) {
    return res.status(400).json({ message: 'Missing required field: itemId' });
  }

  connection.query('INSERT INTO cart_items (menu_item_id, user_id, quantity) VALUES (?, ?, 1)', [itemId, userId], (err, result) => {
    if (err) {
      console.error('Error inserting into cart_items:', err);
      return res.status(500).json({ message: 'Error adding item to cart' });
    }

    console.log('Item added to cart successfully!');
    res.status(200).json({ message: 'Item added to cart successfully!' });
  });
});

// Route to get menu items
app.get('/menu', (req, res) => {
  console.log('Received request to /menu');
  connection.query('SELECT * FROM menu_items', (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ message: 'Error querying database' });
    }
    res.status(200).json(results);
  });
});


// Route to get cart items
app.get('/cart', (req, res) => {
  console.log('Received request to /cart');
  const userId = 123; // Placeholder user ID

  connection.query('SELECT ci.id, ci.menu_item_id, ci.quantity, mi.name,  mi.price, mi.image FROM cart_items ci JOIN menu_items mi ON ci.menu_item_id = mi.id WHERE ci.user_id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ message: 'Error querying database' });
    }
    res.status(200).json(results);
  });
});

// Route to update item quantity in cart
app.put('/update-cart-item', (req, res) => {
  console.log('Received request to /update-cart-item');
  const { itemId, quantity } = req.body;
  const userId = 123; // Placeholder user ID

  if (!itemId || quantity == null) {
    return res.status(400).json({ message: 'Missing required fields: itemId and/or quantity' });
  }

  connection.query('UPDATE cart_items SET quantity = ? WHERE menu_item_id = ? AND user_id = ?', [quantity, itemId, userId], (err, result) => {
    if (err) {
      console.error('Error updating cart item:', err);
      return res.status(500).json({ message: 'Error updating cart item' });
    }

    console.log('Cart item updated successfully!');
    res.status(200).json({ message: 'Cart item updated successfully!' });
  });
});

  // Endpoint to place a new order
app.post('/order-now', (req, res) => {
  const { deliveryAddress, userId, items, rollNumber } = req.body; // Extract userId and items from request body
  if (!userId) {
    return res.status(400).json({ message: 'Missing required field: userId' });
  }
  if (!deliveryAddress) {
    return res.status(400).json({ message: 'Missing required field: deliveryAddress' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing or invalid items array' });
  }

  // Insert logic for placing the order in the database
  // Example:
  connection.beginTransaction(function(err) {
    if (err) { 
      console.error('Error starting transaction:', err);
      return res.status(500).json({ message: 'Error placing order' });
    }
    
    connection.query('INSERT INTO orders (user_id, delivery_address,roll_number) VALUES (?, ?, ?)', [userId, deliveryAddress, rollNumber], (err, result) => {
      if (err) {
        console.error('Error inserting into orders:', err);
        return connection.rollback(function() {
          res.status(500).json({ message: 'Error placing order' });
        });
      }
      
      const orderId = result.insertId;
      
      const orderItemsValues = items.map(item => [orderId, item.menu_item_id, item.quantity]);
      connection.query('INSERT INTO order_items (order_id, menu_item_id, quantity) VALUES ?', [orderItemsValues], (err, result) => {
        if (err) {
          console.error('Error inserting into order_items:', err);
          return connection.rollback(function() {
            res.status(500).json({ message: 'Error placing order' });
          });
        }
        
        connection.commit(function(err) {
          if (err) {
            console.error('Error committing transaction:', err);
            return connection.rollback(function() {
              res.status(500).json({ message: 'Error placing order' });
            });
          }
          
          console.log('Order placed successfully!');
          res.status(200).json({ message: 'Order placed successfully!' });
        });
      });
    });
  });
});

// Add a new endpoint to handle item deletion
app.delete('/admin/delete-item/:id', (req, res) => {
  const itemId = req.params.id;

  if (!itemId) {
      return res.status(400).json({ message: 'Missing required field: id' });
  }

  connection.query('DELETE FROM menu_items WHERE id = ?', [itemId], (err, result) => {
      if (err) {
          console.error('Error deleting menu item:', err);
          return res.status(500).json({ message: 'Error deleting menu item' });
      }

      res.status(200).json({ message: 'Item deleted successfully!' });
  });
});

// Endpoint to fetch orders with associated items including roll number
// Endpoint to fetch orders with associated items including roll number
app.get('/admin/orders', (req, res) => {
  connection.query('SELECT o.id AS orderId, o.order_date, o.delivery_address, o.roll_number, GROUP_CONCAT(oi.menu_item_id) AS itemIds, GROUP_CONCAT(oi.quantity) AS quantities FROM orders o JOIN order_items oi ON o.id = oi.order_id GROUP BY o.id', (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ message: 'Error querying database' });
    }
    const orders = results.map(order => {
      const itemIds = order.itemIds ? order.itemIds.split(',').map(id => parseInt(id)) : [];
      const quantities = order.quantities ? order.quantities.split(',').map(qty => parseInt(qty)) : [];
      return {
          orderId: order.orderId,
          orderDate: order.order_date,
          deliveryAddress: order.delivery_address,
          rollNumber: order.roll_number,
          items: itemIds.map((itemId, index) => ({ itemId, quantity: quantities[index] })),
      };
  });
  
    res.status(200).json(orders);
  });
});



// Endpoint to get a specific menu item by ID
app.get('/menu_items/:id', (req, res) => {
  const itemId = req.params.id;
  connection.query('SELECT * FROM menu_items WHERE id = ?', [itemId], (err, result) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ message: 'Error querying database' });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.status(200).json(result[0]);
  });
});


// Endpoint to add a new menu item
app.post('/admin/add-item', (req, res) => {
  console.log('Received request to /admin/add-item:', req.body);
  const { name, price, image } = req.body;

  if (!name || !price || !image) {
    console.error('Missing required fields');
    return res.status(400).json({ message: 'All fields are required' });
  }

  connection.query(
    'INSERT INTO menu_items (name, price, image) VALUES (?, ?, ?)',
    [name, price, image],
    (err, result) => {
      if (err) {
        console.error('Error adding menu item:', err);
        return res.status(500).json({ message: 'Error adding menu item' });
      }
      console.log('Menu item added successfully!');
      res.status(200).json({ message: 'Menu item added successfully!' });
    }
  );
});



// Endpoint to update the price of a menu item
app.post('/admin/update-price', (req, res) => {
  const { id, price } = req.body;

  if (!id || price == null) {
    return res.status(400).json({ message: 'Missing required fields: id and/or price' });
  }

  connection.query('UPDATE menu_items SET price = ? WHERE id = ?', [price, id], (err, result) => {
    if (err) {
      console.error('Error updating menu item price:', err);
      return res.status(500).json({ message: 'Error updating menu item price' });
    }

    res.status(200).json({ message: 'Price updated successfully!' });
  });
});

// Route to get ordered items for a specific order
app.get('/order-items/:orderId', (req, res) => {
  const orderId = req.params.orderId;

  connection.query('SELECT oi.menu_item_id, oi.quantity, mi.name, mi.price FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = ?', [orderId], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ message: 'Error querying database' });
    }
    res.status(200).json(results);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Trying a different port...`);
    app.listen(0, () => {  // 0 will assign a random available port
      console.log(`Server is running on http://localhost:${app.address().port}`);
    });
  } else {
    console.error(err);
  }
});

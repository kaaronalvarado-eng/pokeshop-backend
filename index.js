require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); // Permite llamadas desde React (localhost:5173 y Vercel)

const conexion = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pokeshop',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10
});

// Ejecuta una consulta y responde con error 500 sin tumbar el servidor
function consulta(res, sql, params, ok) {
  conexion.query(sql, params, (err, r) => {
    if (err) {
      // 1451 = el registro está usado por otra tabla (ventas)
      if (err.errno === 1451) return res.status(409).json({ error: 'No se puede eliminar: tiene ventas asociadas.' });
      return res.status(500).json({ error: err.sqlMessage || err.message });
    }
    ok(r);
  });
}

app.get('/', (req, res) => res.json({ mensaje: 'API PokeShop funcionando' }));

// ---------- CLIENTES ----------
app.get('/clientes', (req, res) =>
  consulta(res, 'SELECT * FROM clientes ORDER BY id DESC', [], r => res.json(r)));

app.post('/clientes', (req, res) => {
  const { nombre, ciudad } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  consulta(res, 'INSERT INTO clientes (nombre, ciudad) VALUES (?, ?)', [nombre, ciudad || null],
    () => res.json({ message: 'Cliente registrado correctamente' }));
});

app.put('/clientes/:id', (req, res) => {
  const { nombre, ciudad } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  consulta(res, 'UPDATE clientes SET nombre=?, ciudad=? WHERE id=?', [nombre, ciudad || null, req.params.id],
    () => res.json({ message: `Cliente ${req.params.id} actualizado` }));
});

app.delete('/clientes/:id', (req, res) =>
  consulta(res, 'DELETE FROM clientes WHERE id=?', [req.params.id],
    () => res.json({ message: `Cliente ${req.params.id} eliminado` })));

// ---------- PRODUCTOS ----------
app.get('/productos', (req, res) =>
  consulta(res, 'SELECT * FROM productos ORDER BY id', [], r => res.json(r)));

app.post('/productos', (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre || precio === '' || precio == null)
    return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  consulta(res, 'INSERT INTO productos (nombre, precio) VALUES (?, ?)', [nombre, precio],
    () => res.json({ message: 'Producto registrado correctamente' }));
});

app.put('/productos/:id', (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre || precio === '' || precio == null)
    return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  consulta(res, 'UPDATE productos SET nombre=?, precio=? WHERE id=?', [nombre, precio, req.params.id],
    () => res.json({ message: `Producto ${req.params.id} actualizado` }));
});

app.delete('/productos/:id', (req, res) =>
  consulta(res, 'DELETE FROM productos WHERE id=?', [req.params.id],
    () => res.json({ message: `Producto ${req.params.id} eliminado` })));

// ---------- VENTAS (JOIN múltiple) ----------
app.get('/ventas', (req, res) => {
  const sql = `
    SELECT v.id, c.nombre AS cliente, p.nombre AS producto, v.cantidad,
           DATE_FORMAT(v.fecha, '%Y-%m-%d') AS fecha, p.precio,
           (v.cantidad * p.precio) AS total, v.cliente_id, v.producto_id
    FROM ventas v
    INNER JOIN clientes c ON v.cliente_id = c.id
    INNER JOIN productos p ON v.producto_id = p.id
    ORDER BY v.id DESC`;
  consulta(res, sql, [], r => res.json(r));
});

app.post('/ventas', (req, res) => {
  const { cliente_id, producto_id, cantidad, fecha } = req.body;
  if (!cliente_id || !producto_id || !cantidad || !fecha)
    return res.status(400).json({ error: 'Faltan datos de la venta' });
  consulta(res,
    'INSERT INTO ventas (cliente_id, producto_id, cantidad, fecha) VALUES (?, ?, ?, ?)',
    [cliente_id, producto_id, cantidad, fecha],
    () => res.json({ message: 'Venta registrada correctamente' }));
});

app.put('/ventas/:id', (req, res) => {
  const id = req.params.id;
  const { cliente_id, producto_id, cantidad, fecha } = req.body;
  consulta(res,
    'UPDATE ventas SET cliente_id=?, producto_id=?, cantidad=?, fecha=? WHERE id=?',
    [cliente_id, producto_id, cantidad, fecha, id],
    () => res.json({ message: `Venta con ID ${id} actualizada` }));
});

app.delete('/ventas/:id', (req, res) => {
  const id = req.params.id;
  consulta(res, 'DELETE FROM ventas WHERE id=?', [id],
    () => res.json({ message: `Venta con ID ${id} eliminada` }));
});

app.listen(PORT, () => console.log(`Servidor Express corriendo en puerto ${PORT}`));

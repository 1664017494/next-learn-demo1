import postgres from 'postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

// const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });


const mysql = require('mysql2/promise')

// 创建全局的 MySQL 连接池
const pool = mysql.createPool({
  connectionLimit: 10,
  host: '127.0.0.1', // 服务器地址
  user: 'root',
  password: 'root', // 密码
  database: 'nextjs-dashboard',
})

export async function fetchRevenue() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute('SELECT * FROM revenue');
    return rows as Revenue[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  } finally {
    connection.release();
  }
}

export async function fetchLatestInvoices() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5
    `);
    
    const latestInvoices = (rows as LatestInvoiceRaw[]).map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  } finally {
    connection.release();
  }
}

export async function fetchCardData() {
  const connection = await pool.getConnection();
  try {
    const [invoiceCount] = await connection.execute('SELECT COUNT(*) AS count FROM invoices');
    const [customerCount] = await connection.execute('SELECT COUNT(*) AS count FROM customers');
    const [invoiceStatus] = await connection.execute(`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
      FROM invoices
    `);

    const numberOfInvoices = Number(invoiceCount[0].count ?? '0');
    const numberOfCustomers = Number(customerCount[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(invoiceStatus[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(invoiceStatus[0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  } finally {
    connection.release();
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const connection = await pool.getConnection();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const searchPattern = `%${query}%`;
  
  try {
    const [rows] = await connection.execute(`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name LIKE ? COLLATE utf8mb4_general_ci OR
        customers.email LIKE ? COLLATE utf8mb4_general_ci OR
        CAST(invoices.amount AS CHAR) LIKE ? COLLATE utf8mb4_general_ci OR
        DATE_FORMAT(invoices.date, '%Y-%m-%d') LIKE ? OR
        invoices.status LIKE ? COLLATE utf8mb4_general_ci
      ORDER BY invoices.date DESC
      LIMIT ? OFFSET ?
    `, [
      searchPattern, searchPattern, searchPattern, 
      searchPattern, searchPattern,
      ITEMS_PER_PAGE, offset
    ]);
    
    return rows as InvoicesTable[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  } finally {
    connection.release();
  }
}

export async function fetchInvoicesPages(query: string) {
  const connection = await pool.getConnection();
  const searchPattern = `%${query}%`;
  
  try {
    const [result] = await connection.execute(`
      SELECT COUNT(*) AS count
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name LIKE ? COLLATE utf8mb4_general_ci OR
        customers.email LIKE ? COLLATE utf8mb4_general_ci OR
        CAST(invoices.amount AS CHAR) LIKE ? COLLATE utf8mb4_general_ci OR
        DATE_FORMAT(invoices.date, '%Y-%m-%d') LIKE ? OR
        invoices.status LIKE ? COLLATE utf8mb4_general_ci
    `, [
      searchPattern, searchPattern, searchPattern, 
      searchPattern, searchPattern
    ]);
    
    const totalPages = Math.ceil(Number(result[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  } finally {
    connection.release();
  }
}

export async function fetchInvoiceById(id: string) {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ?
    `, [id]);
    
    const invoice = (rows as InvoiceForm[]).map((inv) => ({
      ...inv,
      amount: inv.amount / 100
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  } finally {
    connection.release();
  }
}

export async function fetchCustomers() {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `);
    
    return rows as CustomerField[];
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  } finally {
    connection.release();
  }
}

export async function fetchFilteredCustomers(query: string) {
  const connection = await pool.getConnection();
  const searchPattern = `%${query}%`;
  
  try {
    const [rows] = await connection.execute(`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name LIKE ? COLLATE utf8mb4_general_ci OR
        customers.email LIKE ? COLLATE utf8mb4_general_ci
      GROUP BY customers.id
      ORDER BY customers.name ASC
    `, [searchPattern, searchPattern]);
    
    const customers = (rows as CustomersTableType[]).map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  } finally {
    connection.release();
  }
}
'use server'
import bcrypt from 'bcrypt';
import postgres from 'postgres';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';


import { NextResponse } from 'next/server'
const mysql = require('mysql2/promise')
 
// const sql = postgres(process.env.DATABASE_URL!);


// 创建全局的 MySQL 连接池
const pool = mysql.createPool({
  connectionLimit: 10,
  host: '127.0.0.1', // 服务器地址
  user: 'root',
  password: 'root', // 密码
  database: 'nextjs-dashboard',
})

async function seedUsers(connection: any) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return connection.execute(
        `INSERT IGNORE INTO users (id, name, email, password)
         VALUES (?, ?, ?, ?)`, 
        [user.id, user.name, user.email, hashedPassword]
      );
    })
  );

  return insertedUsers;
}

async function seedInvoices(connection: any) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id CHAR(36) NOT NULL PRIMARY KEY,
      customer_id CHAR(36) NOT NULL,  -- 改为 CHAR(36)
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `);

  const insertedInvoices = await Promise.all(
    invoices.map((invoice, index) => 
      connection.execute(
        `INSERT IGNORE INTO invoices (id, customer_id, amount, status, date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          index +1, 
          invoice.customer_id,
          invoice.amount,
          invoice.status,
          invoice.date
        ]
      )
    )
  );

  return insertedInvoices;
}

async function seedCustomers(connection: any) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `);

  const insertedCustomers = await Promise.all(
    customers.map((customer) => 
      connection.execute(
        `INSERT IGNORE INTO customers (id, name, email, image_url)
         VALUES (?, ?, ?, ?)`,
        [
          customer.id,
          customer.name,
          customer.email,
          customer.image_url
        ]
      )
    )
  );

  return insertedCustomers;
}

async function seedRevenue(connection: any) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `);

  const insertedRevenue = await Promise.all(
    revenue.map((rev) => 
      connection.execute(
        `INSERT IGNORE INTO revenue (month, revenue)
         VALUES (?, ?)`,
        [rev.month, rev.revenue]
      )
    )
  );

  return insertedRevenue;
}

export async function GET() {
  try {

    // 从连接池中获取连接
    const connection = await pool.getConnection()

    
      // seedUsers(connection),
      // seedCustomers(connection),
      seedInvoices(connection),
      // seedRevenue(connection),

 
    // 释放连接回连接池
    connection.release()

    // const result = await sql.begin((sql) => [
    //   // seedUsers(),
    //   // seedCustomers(),
    //   // seedInvoices(),
    //   // seedRevenue(),
    // ]);

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.log("@@@", error);
    
    return Response.json({ error }, { status: 500 });
  }
}

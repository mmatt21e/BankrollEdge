package com.bankrolledge.app.data.repository

import com.bankrolledge.app.data.local.TransactionDao
import com.bankrolledge.app.data.local.entity.TransactionEntity
import kotlinx.coroutines.flow.Flow

/** Thin repository over [TransactionDao]. */
class TransactionRepository(private val dao: TransactionDao) {

    val transactions: Flow<List<TransactionEntity>> = dao.observeAll()

    suspend fun getAllChronological(): List<TransactionEntity> = dao.getAllChronological()

    suspend fun add(transaction: TransactionEntity): Long = dao.insert(transaction)

    suspend fun delete(transaction: TransactionEntity) = dao.delete(transaction)

    suspend fun deleteAll() = dao.deleteAll()
}

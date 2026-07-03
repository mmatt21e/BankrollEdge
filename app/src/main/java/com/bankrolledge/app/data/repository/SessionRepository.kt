package com.bankrolledge.app.data.repository

import com.bankrolledge.app.data.local.SessionDao
import com.bankrolledge.app.data.local.entity.SessionEntity
import kotlinx.coroutines.flow.Flow

/** Thin repository over [SessionDao] so ViewModels don't touch Room directly. */
class SessionRepository(private val dao: SessionDao) {

    val sessions: Flow<List<SessionEntity>> = dao.observeAll()

    suspend fun getById(id: Long): SessionEntity? = dao.getById(id)

    suspend fun getAllChronological(): List<SessionEntity> = dao.getAllChronological()

    /** Inserts a new session or updates an existing one (id > 0). */
    suspend fun upsert(session: SessionEntity): Long =
        if (session.id == 0L) dao.insert(session) else {
            dao.update(session)
            session.id
        }

    suspend fun delete(session: SessionEntity) = dao.delete(session)

    suspend fun deleteAll() = dao.deleteAll()
}

package com.bankrolledge.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A bankroll adjustment that isn't a poker session: money deposited into the
 * bankroll or withdrawn from it. [amount] is always positive; [type] gives
 * the direction.
 */
@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    /** [TYPE_DEPOSIT] or [TYPE_WITHDRAWAL]. */
    val type: String = TYPE_DEPOSIT,

    /** Always positive; sign comes from [type]. */
    val amount: Double = 0.0,

    @ColumnInfo(name = "time")
    val time: Long = 0L,

    val note: String = "",
) {
    val isDeposit: Boolean get() = type == TYPE_DEPOSIT

    /** Positive for deposits, negative for withdrawals. */
    val signedAmount: Double get() = if (isDeposit) amount else -amount

    companion object {
        const val TYPE_DEPOSIT = "DEPOSIT"
        const val TYPE_WITHDRAWAL = "WITHDRAWAL"
    }
}

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from partners.models import Partner, PartnerPayment, PartnerStatus, PartnerSale, ProgramActivity
from partners.utils.activity import log_activity
from partners.utils.codes import assign_creator_codes
from partners.utils.commission import refresh_partner_totals
from partners.utils.notifications import notify_partner_status_change
from partners.utils.qr_generator import ensure_partner_qr


@receiver(pre_save, sender=Partner)
def track_partner_status_changes(sender, instance, **kwargs):
    instance._previous_status = None
    if not instance.pk:
        return

    previous = Partner.objects.filter(pk=instance.pk).first()
    if not previous:
        return

    instance._previous_status = previous.status

    if previous.status != PartnerStatus.APPROVED and instance.status == PartnerStatus.APPROVED:
        if not instance.approved_at:
            instance.approved_at = timezone.now()
        assign_creator_codes(instance)
        log_activity(
            ProgramActivity.EventType.PARTNER_APPROVED,
            partner=instance,
            user=instance.user,
            description=f"{instance.partner_name} approved for the partner program.",
            metadata={
                "partner_code": instance.partner_code,
                "discount_code": instance.discount_code,
            },
        )
    elif previous.status != PartnerStatus.REJECTED and instance.status == PartnerStatus.REJECTED:
        log_activity(
            ProgramActivity.EventType.PARTNER_REJECTED,
            partner=instance,
            user=instance.user,
            description=f"{instance.partner_name} application rejected.",
        )
    elif previous.status != PartnerStatus.SUSPENDED and instance.status == PartnerStatus.SUSPENDED:
        log_activity(
            ProgramActivity.EventType.PARTNER_SUSPENDED,
            partner=instance,
            user=instance.user,
            description=f"{instance.partner_name} suspended.",
        )


@receiver(post_save, sender=Partner)
def provision_approved_partner_assets(sender, instance, created, **kwargs):
    if instance.status != PartnerStatus.APPROVED:
        return

    if not instance.partner_code or not instance.discount_code:
        if assign_creator_codes(instance):
            Partner.objects.filter(pk=instance.pk).update(
                partner_code=instance.partner_code,
                discount_code=instance.discount_code,
            )
            instance.refresh_from_db(fields=["partner_code", "discount_code"])

    ensure_partner_qr(instance)


@receiver(post_save, sender=Partner)
def send_partner_status_notifications(sender, instance, created, **kwargs):
    if created:
        return

    previous = getattr(instance, "_previous_status", None)
    if previous is None or previous == instance.status:
        return

    admin_message = getattr(instance, "_admin_status_message", "")
    notify_partner_status_change(instance, instance.status, admin_message)


@receiver(post_save, sender=PartnerSale)
def update_totals_on_sale_change(sender, instance, created, **kwargs):
    refresh_partner_totals(instance.partner)

    if created:
        log_activity(
            ProgramActivity.EventType.SALE_CREATED,
            partner=instance.partner,
            sale=instance,
            description=f"Sale {instance.order_id} recorded (${instance.total}).",
            metadata={
                "order_id": instance.order_id,
                "total": str(instance.total),
                "commission": str(instance.commission_amount),
                "status": instance.status,
            },
        )


@receiver(post_save, sender=PartnerPayment)
def log_payout_activity(sender, instance, created, **kwargs):
    from partners.models import PaymentStatus

    event_type = ProgramActivity.EventType.PAYOUT_CREATED
    if not created and instance.status == PaymentStatus.PAID:
        event_type = ProgramActivity.EventType.PAYOUT_PAID

    log_activity(
        event_type,
        partner=instance.partner,
        payment=instance,
        description=f"Payout ${instance.amount} — {instance.get_status_display()}.",
        metadata={
            "period_start": str(instance.period_start),
            "period_end": str(instance.period_end),
            "status": instance.status,
        },
    )
